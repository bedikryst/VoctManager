"""
@file score_package_builder.py
@description Deterministic assembler for a Project's concert score book.
    Phase 1: front matter (title + TOC) + bound editions on A4 + continuous page
    numbers + PDF outline. Phase 2: per-piece text content — a frontispiece before
    each piece (CONCERT density) or one consolidated "Teksty i tłumaczenia" section
    (MASS density). Phase 3 (build cockpit): per-item edition selection, source
    page-range trimming, per-item card element/override resolution, and a
    placeholder divider for repertoire that still lacks engraved music. All
    deterministic WeasyPrint + pypdf — no AI, and never drawing on the music.
@architecture Enterprise SaaS 2026
@module roster/infrastructure/score_package_builder
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from io import BytesIO
from itertools import zip_longest

from django.conf import settings
from django.template.loader import render_to_string
from pypdf import PdfReader, PdfWriter, Transformation

from archive.models import Piece, ScoreEdition
from roster.infrastructure.document_generator import (
    DocumentRenderDependencyError,
    _render_pdf,
)
from roster.infrastructure.print_fonts import BOOK_FONT_STACK, font_face_css
from roster.models import ProgramItem, Project, ScorePackage
from roster.score_package_config import (
    ResolvedCardConfig,
    composer_label,
    movement_titles,
    resolve_card_config,
    resolve_item_edition,
    resolve_item_translation,
    select_program_note,
)
from roster.score_package_layout import BodyPage, plan_body_layout

logger = logging.getLogger(__name__)

# A4 in PDF points (1pt = 1/72"). 210mm x 297mm.
A4_WIDTH_PT: float = 595.2756
A4_HEIGHT_PT: float = 841.8898
# Safe inner margin when fitting a source page onto the A4 sheet, so nothing is
# clipped at the print edge. The engraving keeps its own musical margins inside this.
BODY_MARGIN_PT: float = 14.0

TEXTS_SECTION_HEADER: str = "Teksty i tłumaczenia"
EN_DASH: str = "–"  # noqa: RUF001


def _ensemble_name() -> str:
    """Resident-ensemble name for the printed book, from settings (rebrandable)."""
    return getattr(settings, "SCORE_BOOK_ENSEMBLE_NAME", "VoctEnsemble")


def _doc_lang() -> str:
    """Document language for print hyphenation + template chrome, from settings."""
    return getattr(settings, "SCORE_BOOK_LANG", "pl")


class ScorePackageBuildError(RuntimeError):
    """Raised when the book cannot be assembled (e.g. no piece has a usable PDF)."""


@dataclass
class PlannedItem:
    """One program item placed in the book. A bound item carries a slice of its
    edition PDF; a placeholder represents a piece whose music is not yet attached
    (it still gets a divider page so the pagination and TOC stay truthful)."""

    item: ProgramItem
    order: int
    title: str
    composer_label: str
    piece: Piece
    edition: ScoreEdition | None
    reader: PdfReader | None
    start_index: int          # 0-based first source page to bind
    bound_page_count: int     # number of source pages bound (0 for a placeholder)
    is_placeholder: bool
    # Resolved during planning:
    card_bytes: bytes | None = None
    card_count: int = 0
    start_page: int = 1       # 1-based printed folio the item opens on (drives the TOC)
    phys_start: int = 0       # 0-based physical offset in the body (drives the outline)
    leading_blank: bool = False  # a recto-start blank verso precedes this item (duplex)


@dataclass
class BuildResult:
    """Outcome of an assembly run."""

    pdf_bytes: bytes
    page_count: int
    bound_pieces: int
    skipped_titles: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Piece resolution
# ---------------------------------------------------------------------------

def _composer_parts(piece: Piece) -> tuple[str, str]:
    """Frontispiece composer line split into (name, years), e.g. ('A. Bruckner', '1824-1896')."""
    composer = piece.composer
    if not composer:
        return "", ""
    name = f"{composer.first_name} {composer.last_name}".strip()
    birth = (composer.birth_year or "").strip()
    death = (composer.death_year or "").strip()
    if birth and death:
        years = f"{birth}{EN_DASH}{death}"
    elif birth:
        years = f"ur. {birth}"
    else:
        years = ""
    return name, years


def _format_duration(seconds: int | None) -> str:
    """Compact duration for the meta strip, e.g. '~4 min'. Empty for missing/zero."""
    if not seconds:
        return ""
    minutes = round(seconds / 60)
    return f"~{minutes} min" if minutes >= 1 else "<1 min"


def _stanza_blocks(raw: str) -> list[list[str]]:
    """Split sung text into stanzas: blank-line-separated groups of trimmed,
    non-empty lines. This is the shape the print layer needs — each line becomes
    its own hanging-indent block, so a verse that overflows the column wraps
    with a visually subordinate continuation instead of a fake new verse."""
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in (raw or "").splitlines():
        stripped = line.strip()
        if stripped:
            current.append(stripped)
        elif current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    return blocks


def _stanza_rows(text: str, translation: str) -> list[dict[str, list[str]]]:
    """Pair original and translation stanza-by-stanza. Row N holds stanza N of
    each side, so the columns stay aligned even when their line counts differ —
    the reader always finds the translation of the stanza they are singing
    directly across from it. A side that runs out of stanzas yields empty rows
    (its column simply stays blank), and each row is an unbreakable print unit,
    which also sidesteps WeasyPrint's fragile flex fragmentation on multi-page
    texts."""
    empty: list[str] = []
    return [
        {"original": original, "translation": translated}
        for original, translated in zip_longest(
            _stanza_blocks(text), _stanza_blocks(translation), fillvalue=empty
        )
    ]


# Auto text-scale for the verse body. A conservative character heuristic
# (Gentium averages ~0.45em advance; a two-column verse column is ~78mm ≈ 44
# chars at 11pt). The hanging indent stays the correctness net — the scale only
# reduces how often a long verse line wraps at all.
_TWO_COL_CHARS_AT_11PT: int = 44
_TWO_COL_CHARS_AT_10PT: int = 49
_ONE_COL_CHARS_AT_11PT: int = 95


def _text_scale(rows: list[dict[str, list[str]]], two_cols: bool) -> str:
    """CSS scale class for the verse body — '' (base) / 'compact' / 'dense' —
    from the longest line's character count in the card's column geometry."""
    longest = max(
        (
            len(line)
            for row in rows
            for side in ("original", "translation")
            for line in row[side]
        ),
        default=0,
    )
    if two_cols:
        if longest <= _TWO_COL_CHARS_AT_11PT:
            return ""
        return "compact" if longest <= _TWO_COL_CHARS_AT_10PT else "dense"
    return "" if longest <= _ONE_COL_CHARS_AT_11PT else "compact"


def _read_edition_pdf(edition: ScoreEdition) -> PdfReader:
    """Load an edition's PDF fully into memory (storage-agnostic) as a reader."""
    with edition.pdf_file.open("rb") as handle:
        data = handle.read()
    return PdfReader(BytesIO(data))


def _page_window(total: int, start: int | None, end: int | None) -> tuple[int, int]:
    """Clamp a 1-based [start, end] request to a valid window of a `total`-page
    source, returning (0-based start index, page count). Blank bounds mean the
    natural edge (page 1 / last page)."""
    first = start or 1
    last = end or total
    first = max(1, min(first, total))
    last = max(first, min(last, total))
    return first - 1, last - first + 1


def _resolve_program(project: Project) -> list[PlannedItem]:
    """Resolve the project's ordered programme into planned items. Every program
    item is represented — bound to a trimmed edition slice, or as a placeholder
    when no readable edition is attached."""
    items = (
        ProgramItem.objects.filter(project=project)
        .select_related("piece", "piece__composer", "score_edition")
        .prefetch_related(
            "piece__editions", "piece__translations", "piece__program_notes",
            "piece__movements",
        )
        .order_by("order")
    )

    planned: list[PlannedItem] = []
    for item in items:
        piece = item.piece
        edition = resolve_item_edition(item)
        reader: PdfReader | None = None
        total = 0
        if edition is not None:
            try:
                reader = _read_edition_pdf(edition)
                total = len(reader.pages)
            except Exception as exc:
                logger.warning(
                    "score_package.unreadable_edition project=%s piece=%s edition=%s err=%s",
                    project.pk, piece.title, edition.pk, exc,
                )
                reader = None
                total = 0

        if reader is not None and total > 0:
            start_index, count = _page_window(total, item.pdf_page_start, item.pdf_page_end)
            planned.append(PlannedItem(
                item=item,
                order=item.order,
                title=piece.title,
                composer_label=composer_label(piece),
                piece=piece,
                edition=edition,
                reader=reader,
                start_index=start_index,
                bound_page_count=count,
                is_placeholder=False,
            ))
        else:
            planned.append(PlannedItem(
                item=item,
                order=item.order,
                title=piece.title,
                composer_label=composer_label(piece),
                piece=piece,
                edition=None,
                reader=None,
                start_index=0,
                bound_page_count=0,
                is_placeholder=True,
            ))
    return planned


# ---------------------------------------------------------------------------
# WeasyPrint rendering (front matter, cards, numbering overlay)
# ---------------------------------------------------------------------------

def _card_context(
    planned: PlannedItem,
    config: ResolvedCardConfig,
    package: ScorePackage,
    project: Project,
    page_label: str,
) -> dict:
    """Assemble one item's card context from existing AI data, honouring its
    resolved element set and per-item overrides."""
    piece = planned.piece
    item = planned.item
    name, years = _composer_parts(piece)
    language = package.translation_language

    if planned.is_placeholder:
        eyebrow = (item.section_label or piece.text_source or "").strip()
        return {
            "placeholder": True,
            "order": planned.order,
            "eyebrow": eyebrow,
            "role": (item.role_prefix or "").strip(),
            "title": piece.title,
            "composer": name,
            "years": years,
            "arranger": piece.arranger or "",
            "meta": [],
            "page_label": page_label,
            "rows": [], "two_cols": False, "text_scale": "",
            "cast": "", "movements": [], "translator": "",
            "note": "", "ipa": "",
            "has_text": False,
        }

    text = (
        (item.text_override or piece.lyrics_original or "").strip()
        if config.shows("text") else ""
    )
    translation = ""
    translator = ""
    # Resolver handles the whole policy: an explicit pin wins (any language),
    # otherwise auto in the package language — suppressed entirely for a piece
    # already sung in the book's language (nothing to translate).
    if config.shows("translation"):
        tr = resolve_item_translation(item, language)
        if tr is not None and (tr.text or "").strip():
            translation = tr.text.strip()
            translator = (tr.translator or "").strip()
    note = ""
    if config.shows("note"):
        if item.note_override:
            note = item.note_override.strip()
        else:
            note_obj = select_program_note(piece, project, language)
            note = (note_obj.content or "").strip() if note_obj else ""
    ipa = (piece.lyrics_ipa or "").strip() if config.shows("ipa") else ""
    eyebrow = (
        (item.section_label or piece.text_source or "").strip()
        if config.shows("eyebrow") else ""
    )

    meta: list[str] = []
    if config.shows("meta"):
        if piece.voicing:
            meta.append(piece.voicing)
        if piece.language:
            meta.append(piece.language)
        duration = _format_duration(piece.estimated_duration)
        if duration:
            meta.append(duration)

    cast = (item.performers or "").strip() if config.shows("cast") else ""
    movements = movement_titles(piece) if config.shows("movements") else []

    rows = _stanza_rows(text, translation)
    two_cols = bool(translation)
    return {
        "placeholder": False,
        "order": planned.order,
        "eyebrow": eyebrow,
        "role": (item.role_prefix or "").strip(),
        "title": piece.title,
        "composer": name,
        "years": years,
        "arranger": piece.arranger or "",
        "meta": meta,
        "page_label": page_label,
        "rows": rows,
        "two_cols": two_cols,
        "text_scale": _text_scale(rows, two_cols),
        "cast": cast,
        "movements": movements,
        "translator": translator,
        "note": note,
        "ipa": ipa,
        "has_text": bool(rows),
    }


def _render_cards(cards: list[dict], section_header: str | None) -> bytes:
    """Render frontispiece(s)/placeholder(s) (section_header=None) or a
    consolidated texts section."""
    html = render_to_string(
        "projects/score_package_cards.html",
        {
            "cards": cards,
            "section_header": section_header,
            "ensemble_name": _ensemble_name(),
            "doc_lang": _doc_lang(),
            "font_css": font_face_css(),
            "font_stack": BOOK_FONT_STACK,
        },
    )
    return _render_pdf(html)


def _render_front_matter(project: Project, package: ScorePackage, toc_entries: list[dict]) -> bytes | None:
    """Render the title page + TOC (WeasyPrint, A4). Returns None when both are disabled."""
    if not (package.include_title_page or package.include_toc):
        return None

    event_dt = project.date_time
    context = {
        "show_title_page": package.include_title_page,
        "show_toc": package.include_toc,
        "ensemble_name": _ensemble_name(),
        "doc_lang": _doc_lang(),
        "font_css": font_face_css(),
        "font_stack": BOOK_FONT_STACK,
        "title": project.title,
        "venue": project.location.name if project.location else "",
        "date_label": event_dt.strftime("%d.%m.%Y") if event_dt else "",
        "time_label": event_dt.strftime("%H:%M") if event_dt else "",
        "toc_entries": toc_entries,
    }
    html = render_to_string("projects/score_package_front_matter.html", context)
    return _render_pdf(html)


def _build_number_overlay(body_page_count: int) -> list:
    """
    Render a WeasyPrint document of `body_page_count` A4 pages, each carrying just
    its continuous page number in the bottom-right of the margin (numbered 1..N).
    The number sits in the outer-bottom corner rather than dead-centre, because
    most engraved editions print *their* page number bottom-centre — overlapping
    two numbers there is the worst case. Returns the overlay pages to be merged
    onto the body pages.
    """
    rows = "".join('<div class="pg"></div>' for _ in range(body_page_count))
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
        + font_face_css()
        + "@page { size: A4; margin: 0 14mm 12mm 0;"
        " @bottom-right { content: counter(page);"
        f" font: 10pt {BOOK_FONT_STACK}; color: #3a3a3a; }} }}"
        ".pg { height: 1px; }"
        ".pg:not(:first-child) { break-before: page; }"
        "</style></head><body>" + rows + "</body></html>"
    )
    overlay = PdfReader(BytesIO(_render_pdf(html)))
    return list(overlay.pages)


def _build_duplex_number_overlay(pages: list[BodyPage]) -> list:
    """
    Duplex numbering overlay: one A4 page per body page, carrying its folio in the
    *outer* bottom corner — right on a recto, left on a verso — so the number always
    falls on the open edge of a bound, double-sided book. The number sits behind a
    small white knockout so it stays legible over dense engraving. Blank recto-start
    spacers get an empty page, keeping the overlay aligned one-to-one with the body.
    """
    rows: list[str] = []
    for page in pages:
        if page.kind == "content" and page.folio is not None:
            side = "recto" if page.is_recto else "verso"
            rows.append(f'<div class="pg {side}"><span class="num">{page.folio}</span></div>')
        else:
            rows.append('<div class="pg"></div>')
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
        + font_face_css()
        + "@page { size: A4; margin: 0; }"
        ".pg { position: relative; width: 210mm; height: 297mm; }"
        ".pg:not(:first-child) { break-before: page; }"
        ".num { position: absolute; bottom: 12mm;"
        f" font: 10pt {BOOK_FONT_STACK}; color: #3a3a3a;"
        " background: #ffffff; padding: 1.5pt 5pt; border-radius: 2pt; }"
        ".recto .num { right: 14mm; }"
        ".verso .num { left: 14mm; }"
        "</style></head><body>" + "".join(rows) + "</body></html>"
    )
    overlay = PdfReader(BytesIO(_render_pdf(html)))
    return list(overlay.pages)


# ---------------------------------------------------------------------------
# pypdf assembly
# ---------------------------------------------------------------------------

def _place_on_a4(writer: PdfWriter, source_page, fit: bool) -> None:
    """
    Add one body page as a fresh A4 sheet with the source centred on it.

    `fit=True`  → scale-to-fit within the safe margin (never clips; the default).
    `fit=False` → native 1:1 scale, centred (may clip a source larger than A4).
    Either way the body is uniformly A4, which keeps numbering, printing and
    binding consistent across editions of different sizes.
    """
    # Bake any /Rotate into the content so the visual orientation is preserved
    # before we read the box and transform it.
    source_page.transfer_rotation_to_content()
    box = source_page.mediabox
    src_w = float(box.width)
    src_h = float(box.height)
    if src_w <= 0 or src_h <= 0:
        # Degenerate page — drop a blank A4 rather than crash.
        writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
        return

    scale = (
        min(
            (A4_WIDTH_PT - 2 * BODY_MARGIN_PT) / src_w,
            (A4_HEIGHT_PT - 2 * BODY_MARGIN_PT) / src_h,
        )
        if fit
        else 1.0
    )

    # Centre the (scaled) content on the sheet, accounting for a mediabox whose
    # origin is not at (0,0).
    tx = (A4_WIDTH_PT - src_w * scale) / 2.0 - float(box.left) * scale
    ty = (A4_HEIGHT_PT - src_h * scale) / 2.0 - float(box.bottom) * scale
    ctm = Transformation(ctm=(scale, 0.0, 0.0, scale, tx, ty))

    dest = writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
    dest.merge_transformed_page(source_page, ctm)


def _append_pages(writer: PdfWriter, blob: bytes) -> int:
    """Append every page of an already-A4 WeasyPrint document verbatim. Returns the count."""
    reader = PdfReader(BytesIO(blob))
    for page in reader.pages:
        writer.add_page(page)
    return len(reader.pages)


def _add_outline(writer: PdfWriter, package: ScorePackage, body_start: int, plan: list[PlannedItem]) -> None:
    """Add a navigable PDF outline: front-matter anchors + one item per piece.

    ``body_start`` is the 0-based index of the first music-body page in the writer
    (front matter + any duplex front pad). Each item anchors at its physical offset,
    not its printed folio, since recto-start spacers make the two diverge."""
    if package.include_title_page:
        writer.add_outline_item("Strona tytułowa", 0)
    if package.include_toc:
        writer.add_outline_item("Repertuar", 1 if package.include_title_page else 0)
    for planned in plan:
        absolute_index = body_start + planned.phys_start
        label = f"{planned.order}. {planned.title}"
        if planned.composer_label:
            label = f"{label} — {planned.composer_label}"
        if planned.is_placeholder:
            label = f"{label} (brak nut)"
        writer.add_outline_item(label, absolute_index)


def build_score_package(project: Project, package: ScorePackage) -> BuildResult:
    """
    Assemble the concert score book for `project` under `package`'s settings.

    Pipeline: resolve the programme (per-item edition + page-range) → render a
    frontispiece per piece (CONCERT) or a placeholder for missing music → render
    front matter + (MASS) consolidated texts → bind trimmed editions onto A4 →
    stamp continuous page numbers → add the PDF outline. Pure CPU, no AI.
    """
    plan = _resolve_program(project)
    if not plan:
        raise ScorePackageBuildError("Program koncertu jest pusty — nie ma z czego złożyć partytury.")
    if not any(not p.is_placeholder for p in plan):
        raise ScorePackageBuildError(
            "Żaden utwór w programie nie ma dołączonego PDF-u z nutami — nie ma z czego złożyć partytury."
        )

    cards_on = package.include_cards
    concert_cards = cards_on and package.density_mode == ScorePackage.Density.CONCERT
    mass_texts = cards_on and package.density_mode == ScorePackage.Density.MASS
    duplex = package.duplex_mode
    # Recto-start (every piece opens on a right-hand page) is a Concert-density
    # flourish; Mass density stays compact, so the body flows without blank versos.
    recto_start = duplex and package.density_mode == ScorePackage.Density.CONCERT

    # 1) Render the per-piece cards and count their pages. `cursor` is the printed
    #    folio a card shows ("s. N") — it counts content pages only, so it is the
    #    same whether or not duplex later inserts (unnumbered) recto-start spacers.
    #    A placeholder always gets a divider page; a bound piece gets a frontispiece
    #    only in CONCERT density while its card is kept.
    cursor = 1
    for planned in plan:
        config = resolve_card_config(planned.item, package)
        if planned.is_placeholder or (concert_cards and config.enabled):
            context = _card_context(planned, config, package, project, page_label=f"s. {cursor}")
            planned.card_bytes = _render_cards([context], section_header=None)
            planned.card_count = len(PdfReader(BytesIO(planned.card_bytes)).pages)
        cursor += planned.card_count + planned.bound_page_count

    # Plan the physical body: recto-start spacers, each item's printed folio (TOC),
    # its physical offset (outline) and the recto/verso side of every page.
    layout = plan_body_layout(
        [p.card_count + p.bound_page_count for p in plan],
        recto_start=recto_start,
    )
    for planned, placement in zip(plan, layout.placements, strict=True):
        planned.start_page = placement.folio_start
        planned.phys_start = placement.phys_start
        planned.leading_blank = placement.leading_blank

    toc_entries = [
        {
            "order": planned.order,
            "title": planned.title,
            "composer": planned.composer_label,
            "page": planned.start_page,
            "placeholder": planned.is_placeholder,
        }
        for planned in plan
    ]

    # 2) Front matter: title + TOC, then (MASS only) the consolidated texts section.
    front_bytes = _render_front_matter(project, package, toc_entries)
    texts_bytes: bytes | None = None
    if mass_texts:
        contexts = []
        for planned in plan:
            if planned.is_placeholder:
                continue
            config = resolve_card_config(planned.item, package)
            ctx = _card_context(planned, config, package, project, page_label=f"s. {planned.start_page}")
            if ctx["has_text"]:
                contexts.append(ctx)
        if contexts:
            texts_bytes = _render_cards(contexts, section_header=TEXTS_SECTION_HEADER)

    writer = PdfWriter()
    front_count = 0
    for blob in (front_bytes, texts_bytes):
        if blob is not None:
            front_count += _append_pages(writer, blob)

    # In duplex mode the music body must open on a recto; pad the front matter to an
    # even physical page count so body page 1 is a right-hand page.
    front_pad = (front_count % 2) if duplex else 0
    for _ in range(front_pad):
        writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
    body_start = front_count + front_pad

    # 3) Music body — optional recto-start blank, then card/placeholder (verbatim
    #    A4) and music (normalized A4). `body_count` tracks physical pages (spacers
    #    included), so it stays aligned with the planned layout and the overlay.
    body_count = 0
    for planned in plan:
        if planned.leading_blank:
            writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
            body_count += 1
        if planned.card_bytes is not None:
            body_count += _append_pages(writer, planned.card_bytes)
        if planned.reader is not None:
            end = planned.start_index + planned.bound_page_count
            for source_page in planned.reader.pages[planned.start_index:end]:
                _place_on_a4(writer, source_page, fit=package.normalize_to_a4)
                body_count += 1

    # 4) Page numbers on the body only (front matter stays unnumbered). Duplex puts
    #    the folio in the outer corner (recto-right / verso-left) behind a white
    #    knockout; simplex keeps the single bottom-right column.
    if package.include_page_numbers and body_count > 0:
        overlay_pages = (
            _build_duplex_number_overlay(layout.pages)
            if duplex
            else _build_number_overlay(body_count)
        )
        for offset, overlay_page in enumerate(overlay_pages[:body_count]):
            writer.pages[body_start + offset].merge_page(overlay_page)

    # 5) Navigable outline (anchors at physical offsets, past any front pad).
    if package.include_bookmarks:
        _add_outline(writer, package, body_start, plan)

    buffer = BytesIO()
    writer.write(buffer)

    return BuildResult(
        pdf_bytes=buffer.getvalue(),
        page_count=body_start + body_count,
        bound_pieces=sum(1 for p in plan if not p.is_placeholder),
        skipped_titles=[p.title for p in plan if p.is_placeholder],
    )


def render_item_card_preview(project: Project, package: ScorePackage, item: ProgramItem) -> bytes:
    """Render just one program item's frontispiece/placeholder card to a PDF — the
    cockpit's live "preview this card" affordance. Uses the same context builder as
    the full assembly, so what the conductor sees is what the book gets."""
    piece = item.piece
    edition = resolve_item_edition(item)
    planned = PlannedItem(
        item=item,
        order=item.order,
        title=piece.title,
        composer_label=composer_label(piece),
        piece=piece,
        edition=edition,
        reader=None,
        start_index=0,
        bound_page_count=0,
        is_placeholder=edition is None,
    )
    config = resolve_card_config(item, package)
    context = _card_context(planned, config, package, project, page_label="")
    return _render_cards([context], section_header=None)


__all__ = [
    "BuildResult",
    "DocumentRenderDependencyError",
    "ScorePackageBuildError",
    "build_score_package",
    "render_item_card_preview",
]
