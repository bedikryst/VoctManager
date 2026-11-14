"""
@file score_package_builder.py
@description Deterministic assembler for a Project's concert score book.
    Phase 1: front matter (title + TOC) + bound editions on A4 + continuous page
    numbers + PDF outline. Phase 2: per-piece text content — a frontispiece before
    each piece (CONCERT density) or one consolidated "Teksty i tłumaczenia" section
    (MASS density). Phase 3 (build cockpit): per-item edition selection, source
    page-range trimming, per-item card element/override resolution, and a
    placeholder divider for repertoire that still lacks engraved music. Phase 4
    (one numbering): on a numbered book the strip the folio occupies is kept free
    of source content, and each edition's own printed page numbers are covered
    where they can be proven (see score_source_numbering) — so a page never shows
    the book's folio and the publisher's stacked together. Phase 5 (page map):
    every emitted page is recorded with what it is and, for music, the box the
    source page was placed into, so a position on an edition can still be found
    in the finished book (see score_page_map). A frontispiece is fitted by
    rendering it (see _fit_card), and the cockpit preview binds the same choice.
    All deterministic WeasyPrint + pypdf — no AI, and nothing drawn over the
    engraving but a publisher's folio.
@module roster/infrastructure/score_package_builder
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from io import BytesIO
from itertools import zip_longest

from django.conf import settings
from django.template.loader import render_to_string
from django.utils import translation
from pypdf import PdfReader, PdfWriter, Transformation

from archive.models import Piece, ScoreEdition
from roster.domain.liturgy import ProgramItemPresentation, build_program_presentation
from roster.infrastructure.document_generator import (
    DocumentRenderDependencyError,
    _render_pdf,
)
from roster.infrastructure.print_fonts import BOOK_FONT_STACK, font_face_css
from roster.infrastructure.score_source_numbering import FolioBox, detect_source_folios, review_source_folios
from roster.models import ProgramItem, Project, ScorePackage
from roster.score_package_config import (
    ResolvedCardConfig,
    book_program_items,
    composer_label,
    movement_titles,
    resolve_card_config,
    resolve_item_edition,
    resolve_item_performers,
    resolve_item_translation,
    resolve_page_window,
    resolve_source_numbering,
    select_program_note,
)
from roster.score_package_layout import BodyPage, plan_body_layout
from roster.score_page_map import (
    A4_HEIGHT_PT,
    A4_WIDTH_PT,
    KIND_CARD,
    KIND_FRONT,
    KIND_MUSIC,
    KIND_PAD,
    KIND_SPACER,
    PageKind,
    PageMapRow,
    PlacedBox,
)

logger = logging.getLogger(__name__)

# Safe inner margin when fitting a source page onto the A4 sheet, so nothing is
# clipped at the print edge. The engraving keeps its own musical margins inside this.
BODY_MARGIN_PT: float = 14.0
# Bottom strip kept clear of source content while the book stamps its own folio.
# Without it the source is fitted right down into the strip the folio overlay
# writes into, so an edition's own numbering lands a millimetre above the book's
# — or, at native scale, straight underneath the duplex knockout. 15mm clears the
# tallest folio box (duplex, see _build_duplex_number_overlay) with room to spare.
FOLIO_RESERVE_PT: float = 42.5

TEXTS_SECTION_HEADER: str = "Teksty i tłumaczenia"
EN_DASH: str = "–"  # noqa: RUF001


def _ensemble_name() -> str:
    """Resident-ensemble name for the printed book, from settings (rebrandable)."""
    return getattr(settings, "SCORE_BOOK_ENSEMBLE_NAME", "VoctEnsemble")


def _doc_lang() -> str:
    """Document language for print hyphenation + template chrome, from settings."""
    return getattr(settings, "SCORE_BOOK_LANG", "pl")


@contextmanager
def _book_language() -> Iterator[None]:
    """Render inside the BOOK's language rather than the reader's.

    The liturgical section and role labels are lazy gettext strings, resolved
    wherever they are finally coerced to text. In the Celery worker that is the
    project default; in the cockpit's live card preview it is the requesting
    manager's Accept-Language, because LocaleMiddleware is active. Without this,
    a francophone manager previews "À la communion:" on a card the press will
    print as "Na Komunię:" — the preview's whole promise is that it does not lie.
    """
    with translation.override(_doc_lang()):
        yield


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
    # The edition's own printed page numbers to knock out, keyed by 0-based source
    # page index. Empty when the item keeps them, or when nothing could be proven.
    source_masks: dict[int, list[FolioBox]] = field(default_factory=dict)
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
    # One row per page of ``pdf_bytes``, in order — see roster.score_page_map.
    page_map: list[PageMapRow] = field(default_factory=list)


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


# A stanza pair is one unbreakable print unit, which holds only while it fits a
# page: about 38 lines of 11pt verse fill an A4 card page, and a first page also
# carries the header. Past this many printed lines (wraps estimated at the 11pt
# column width, the widest type the verse uses) the pair is cut into consecutive
# pieces at corresponding source lines, so the page break falls between lines on
# both sides instead of through a flex row WeasyPrint cannot fragment reliably.
_STANZA_MAX_PRINTED_LINES: int = 30


def _printed_lines(lines: list[str], chars_per_line: int) -> int:
    """Estimated printed lines of one column, wraps included."""
    return sum(max(1, -(-len(line) // chars_per_line)) for line in lines)


def _split_tall_rows(
    rows: list[dict[str, list[str]]], two_cols: bool
) -> list[dict[str, object]]:
    """Stanza rows ready for the template: a pair taller than a page becomes
    several rows cut at the same fraction of each side's source lines (the same
    index when the two sides have the same line count), every piece after the
    first marked ``cont`` so it prints flush under the one before. The text is
    never altered or reordered."""
    chars = _TWO_COL_CHARS_AT_11PT if two_cols else _ONE_COL_CHARS_AT_11PT
    shaped: list[dict[str, object]] = []
    for row in rows:
        original, translated = row["original"], row["translation"]
        height = max(_printed_lines(original, chars), _printed_lines(translated, chars))
        pieces = -(-height // _STANZA_MAX_PRINTED_LINES)
        if pieces <= 1:
            shaped.append({"original": original, "translation": translated, "cont": False})
            continue
        for index in range(pieces):
            shaped.append({
                "original": original[
                    round(index * len(original) / pieces):round((index + 1) * len(original) / pieces)
                ],
                "translation": translated[
                    round(index * len(translated) / pieces):round((index + 1) * len(translated) / pieces)
                ],
                "cont": index > 0,
            })
    return shaped


def _note_paragraphs(note: str) -> list[str]:
    """The programme note as printed paragraphs: blank lines separate them, a
    single line break inside one is kept. A paragraph is the unit a page break
    may split, three lines on each side at least."""
    return ["\n".join(block) for block in _stanza_blocks(note)]


def _read_edition_pdf(edition: ScoreEdition) -> PdfReader:
    """Load an edition's PDF fully into memory (storage-agnostic) as a reader, with
    any ``/Rotate`` already baked into the page content.

    The bake happens HERE, before anything measures anything, because two readers
    of the same page must agree on its coordinate space: the folio detector takes
    glyph boxes off the page box, and the binder derives its placement transform
    off the same box. Baking later — at placement time — flips a rotated page's box
    (595x842 becomes 842x595) between those two steps, so every knockout computed
    for it would land somewhere over the engraving instead of over the number.

    Only rotated pages are touched: a no-op bake still prepends a transformation to
    the content stream of every page, which buys nothing.

    pypdf rewrites a page's content only on a page a writer owns (on a reader's
    page 7.0 raises), so a rotated edition is baked on a clone and read back.
    """
    with edition.pdf_file.open("rb") as handle:
        data = handle.read()
    reader = PdfReader(BytesIO(data))
    if not any(page.rotation for page in reader.pages):
        return reader
    writer = PdfWriter(clone_from=reader)
    for page in writer.pages:
        if page.rotation:
            page.transfer_rotation_to_content()
    buffer = BytesIO()
    writer.write(buffer)
    return PdfReader(BytesIO(buffer.getvalue()))


def _page_window(total: int, start: int | None, end: int | None) -> tuple[int, int]:
    """The item's trim window as (0-based start index, page count) — the shape
    pypdf slicing wants, over the bounds resolved by the config SSOT."""
    first, last = resolve_page_window(total, start, end)
    return first - 1, last - first + 1


def _resolve_program(project: Project) -> list[PlannedItem]:
    """Resolve the project's ordered programme into planned items. Every item
    the book binds (`book_program_items`) is represented — bound to a trimmed
    edition slice, or as a placeholder when no readable edition is attached."""
    items = book_program_items(project)

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
    presentation: ProgramItemPresentation,
) -> dict:
    """Assemble one item's card context from existing AI data, honouring its
    resolved element set and per-item overrides.

    The eyebrow and the role line come from the resolved presentation, so a Mass
    prints "Liturgia eucharystyczna" / "Na Komunię 2:" in the book's language
    without anyone having typed either — and a hand-written override still wins,
    because the presentation is where that precedence lives.
    """
    piece = planned.piece
    item = planned.item
    name, years = _composer_parts(piece)
    language = package.translation_language

    if planned.is_placeholder:
        eyebrow = (presentation.section or piece.text_source or "").strip()
        return {
            "placeholder": True,
            "order": planned.order,
            "eyebrow": eyebrow,
            "role": presentation.role_prefix,
            "title": piece.title,
            "composer": name,
            "years": years,
            "arranger": piece.arranger or "",
            "meta": [],
            "page_label": page_label,
            "rows": [], "two_cols": False, "text_scale": "",
            "cast": "", "movements": [], "translator": "",
            "note": "", "note_paragraphs": [], "note_break": False, "ipa": "",
            "spacing": "",
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
        (presentation.section or piece.text_source or "").strip()
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

    cast = resolve_item_performers(item) if config.shows("cast") else ""
    movements = movement_titles(piece) if config.shows("movements") else []

    # Two columns only when both languages print: a single populated language
    # (the original alone, or a translation printed without it) takes the whole
    # measure instead of leaving an empty column beside it.
    two_cols = bool(text) and bool(translation)
    rows = _stanza_rows(text, translation) if two_cols else _stanza_rows(text or translation, "")
    return {
        "placeholder": False,
        "order": planned.order,
        "eyebrow": eyebrow,
        "role": presentation.role_prefix,
        "title": piece.title,
        "composer": name,
        "years": years,
        "arranger": piece.arranger or "",
        "meta": meta,
        "page_label": page_label,
        "rows": _split_tall_rows(rows, two_cols),
        "two_cols": two_cols,
        "text_scale": _text_scale(rows, two_cols),
        "cast": cast,
        "movements": movements,
        "translator": translator,
        "note": note,
        "note_paragraphs": _note_paragraphs(note),
        "note_break": bool(note) and item.note_on_new_page,
        "ipa": ipa,
        # Chosen by _fit_card; the standard layout until it has measured.
        "spacing": "",
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


def _page_count(pdf: bytes) -> int:
    return len(PdfReader(BytesIO(pdf)).pages)


def _fit_card(context: dict) -> tuple[bytes, int]:
    """Render one frontispiece on as few pages as its two candidate layouts allow,
    returning the chosen PDF and its page count.

    The standard spacing first. Only when it overflows, the tight spacing — kept
    only if it actually saves a page, because a card that needs two pages anyway
    reads better with its air. Two renders at most, measured by the real layout
    engine with the book's own font, and the returned bytes ARE the chosen
    rendering: the book binds them and the cockpit preview shows them, so the two
    cannot disagree about where a card breaks. A placeholder divider is laid out
    as it is. A card whose note was sent to its own page is fitted the same way:
    the break is kept, and the tight spacing may still save a page before it.
    """
    standard = _render_cards([{**context, "spacing": ""}], section_header=None)
    pages = _page_count(standard)
    if pages == 1 or context["placeholder"]:
        return standard, pages
    tight = _render_cards([{**context, "spacing": "tight"}], section_header=None)
    tight_pages = _page_count(tight)
    if tight_pages < pages:
        return tight, tight_pages
    return standard, pages


def _stored_card_label(package: ScorePackage, item: ProgramItem) -> str:
    """The page label the stored book prints on this item's card, for the preview.

    The label shares a line with the meta strip — or makes one of its own when no
    meta prints — so a preview without it could fit a card the book overflows.
    A piece the stored book does not hold yet gets a stand-in of the same shape.
    """
    for row in package.page_map or []:
        if isinstance(row, dict) and row.get("item") == str(item.pk) and row.get("folio"):
            return f"s. {row['folio']}"
    return f"s. {EN_DASH}"


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

    The folio box sits low enough to stay inside FOLIO_RESERVE_PT (its top edge
    lands at ~12.3mm) while keeping clear of the print edge, so nothing the body
    carries can ever be printed over — or clipped by — the knockout.
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
        ".num { position: absolute; bottom: 7mm;"
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

def _paint_knockouts(page, rects: list[tuple[float, float, float, float, str]]) -> None:
    """Paint opaque white rectangles (in destination points) over an already-merged
    page — used to cover an edition's own printed folio. Appended to the page's
    content stream so it lands on top of the music, inside its own q/Q so the
    graphics state the merge left behind is not disturbed."""
    if not rects:
        return
    contents = page.get_contents()
    if contents is None:
        return
    ops = ["q"]
    for left, bottom, right, top, tone in rects:
        rgb = " ".join(f"{int(tone[i:i + 2], 16) / 255:.5g}" for i in (1, 3, 5))
        ops.extend([f"{rgb} rg", f"{left:.3f} {bottom:.3f} {right-left:.3f} {top-bottom:.3f} re", "f"])
    ops.append("Q")
    contents.set_data(contents.get_data() + ("\n" + "\n".join(ops) + "\n").encode("latin-1"))
    page.replace_contents(contents)


def _place_on_a4(
    writer: PdfWriter,
    source_page,
    fit: bool,
    *,
    bottom_reserve_pt: float = 0.0,
    masks: list[FolioBox] | None = None,
) -> PlacedBox | None:
    """
    Add one body page as a fresh A4 sheet with the source centred on it.

    `fit=True`  → scale-to-fit within the safe margin (never clips; the default).
    `fit=False` → native 1:1 scale, centred (may clip a source larger than A4).
    Either way the body is uniformly A4, which keeps numbering, printing and
    binding consistent across editions of different sizes.

    ``bottom_reserve_pt`` widens the bottom margin of the box the source is fitted
    into, keeping the strip the folio overlay writes into free of music. It can
    only lift what fits: at native scale a source as tall as the sheet has nowhere
    to go, so it is centred in the reserved box and may still reach low — clipping
    music off the top to buy that millimetre would be the worse trade.
    ``masks`` are boxes in the SOURCE page's coordinates (the edition's own page
    numbers) to knock out once the page is placed.

    Returns the box the source page actually occupies on the sheet. Everything
    that later wants to draw at a musical position — a marking overlay, a future
    per-page provenance stamp — needs exactly that rectangle and nothing else:
    a spot at (u, v) of the source page lands at (x + u·w, y + (1-v)·h).
    """
    # The source must arrive with any /Rotate already baked, as ``_read_edition_pdf``
    # hands it out: the folio masks are measured in that space, and pypdf cannot
    # bake a reader's page in place. Placing it unbaked would turn the music.
    if source_page.rotation:
        raise ValueError("Source page still carries /Rotate; read it through _read_edition_pdf.")
    box = source_page.mediabox
    src_w = float(box.width)
    src_h = float(box.height)
    if src_w <= 0 or src_h <= 0:
        # Degenerate page — drop a blank A4 rather than crash. It carries no
        # source geometry, so nothing may be positioned against it either.
        writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
        return None

    # The box the source is fitted into: the safe margin on three sides, plus any
    # reserved folio strip at the bottom.
    inner_bottom = max(BODY_MARGIN_PT, bottom_reserve_pt)
    inner_w = A4_WIDTH_PT - 2 * BODY_MARGIN_PT
    inner_h = A4_HEIGHT_PT - BODY_MARGIN_PT - inner_bottom

    scale = min(inner_w / src_w, inner_h / src_h) if fit else 1.0

    # Centre the (scaled) content in that box, accounting for a mediabox whose
    # origin is not at (0,0).
    tx = BODY_MARGIN_PT + (inner_w - src_w * scale) / 2.0 - float(box.left) * scale
    ty = inner_bottom + (inner_h - src_h * scale) / 2.0 - float(box.bottom) * scale
    ctm = Transformation(ctm=(scale, 0.0, 0.0, scale, tx, ty))

    dest = writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
    dest.merge_transformed_page(source_page, ctm)
    if masks:
        _paint_knockouts(dest, [
            (
                mask.left * scale + tx,
                mask.bottom * scale + ty,
                mask.right * scale + tx,
                mask.top * scale + ty,
                mask.tone,
            )
            for mask in masks
        ])
    # The placed box in destination points. Derived from the same box the
    # transform was built from, so it survives a mediabox whose origin is not
    # at (0,0) exactly as the merge does.
    return (
        float(box.left) * scale + tx,
        float(box.bottom) * scale + ty,
        src_w * scale,
        src_h * scale,
    )


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

    The whole assembly runs in the book's own language: nothing printed on a page
    may depend on who asked for the build.
    """
    with _book_language():
        return _assemble_book(project, package)


def _assemble_book(project: Project, package: ScorePackage) -> BuildResult:
    """The assembly itself. Called only through ``build_score_package``, which
    pins the document language around it."""
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

    # 1) Locate each edition's own printed page numbers, so the book ends up
    #    carrying one numbering instead of two. Edition review adds scanned
    #    numbers and protects selected areas from text-based detection.
    for planned in plan:
        if planned.reader is None or not resolve_source_numbering(planned.item, package):
            continue
        pages = list(range(planned.start_index, planned.start_index + planned.bound_page_count))
        try:
            planned.source_masks = detect_source_folios(planned.reader, pages)
        except Exception:
            # Numbering is cosmetic; a reader that trips over one edition must not
            # cost the conductor the whole book.
            logger.exception(
                "score_package.source_numbering_failed project=%s piece=%s",
                project.pk, planned.title,
            )
            planned.source_masks = {}
        if planned.edition and (rules := planned.edition.reviewed_folios()):
            review_source_folios(planned.reader, pages, planned.source_masks, rules)

    # 2) Render the per-piece cards and count their pages. `cursor` is the printed
    #    folio a card shows ("s. N") — it counts content pages only, so it is the
    #    same whether or not duplex later inserts (unnumbered) recto-start spacers.
    #    A placeholder always gets a divider page; a bound piece gets a frontispiece
    #    only in CONCERT density while its card is kept.
    # Resolved once for the whole programme: a slot used twice is numbered against
    # its siblings, so no single card can work this out on its own.
    presentations = dict(
        zip(
            (planned.item.pk for planned in plan),
            build_program_presentation([planned.item for planned in plan]),
            strict=True,
        )
    )

    cursor = 1
    for planned in plan:
        config = resolve_card_config(planned.item, package)
        if planned.is_placeholder or (concert_cards and config.enabled):
            context = _card_context(
                planned, config, package, project,
                page_label=f"s. {cursor}",
                presentation=presentations[planned.item.pk],
            )
            planned.card_bytes, planned.card_count = _fit_card(context)
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

    # 3) Front matter: title + TOC, then (MASS only) the consolidated texts section.
    front_bytes = _render_front_matter(project, package, toc_entries)
    texts_bytes: bytes | None = None
    if mass_texts:
        contexts = []
        for planned in plan:
            if planned.is_placeholder:
                continue
            config = resolve_card_config(planned.item, package)
            ctx = _card_context(
                planned, config, package, project,
                page_label=f"s. {planned.start_page}",
                presentation=presentations[planned.item.pk],
            )
            if ctx["has_text"]:
                contexts.append(ctx)
        if contexts:
            texts_bytes = _render_cards(contexts, section_header=TEXTS_SECTION_HEADER)

    writer = PdfWriter()
    # The page map is recorded as pages are emitted, never re-derived afterwards:
    # it must describe THIS pdf, and a second pass over live data could describe a
    # different one. See roster.score_page_map.
    page_map: list[PageMapRow] = []

    def _map(kind: PageKind, **fields: object) -> None:
        row = PageMapRow(phys=len(page_map), kind=kind)
        row.update(fields)  # type: ignore[typeddict-item]
        page_map.append(row)

    front_count = 0
    for blob in (front_bytes, texts_bytes):
        if blob is not None:
            front_count += _append_pages(writer, blob)
    for _ in range(front_count):
        _map(KIND_FRONT)

    # In duplex mode the music body must open on a recto; pad the front matter to an
    # even physical page count so body page 1 is a right-hand page.
    front_pad = (front_count % 2) if duplex else 0
    for _ in range(front_pad):
        writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
        _map(KIND_PAD)
    body_start = front_count + front_pad

    # 4) Music body — optional recto-start blank, then card/placeholder (verbatim
    #    A4) and music (normalized A4). `body_count` tracks physical pages (spacers
    #    included), so it stays aligned with the planned layout and the overlay.
    #    Numbered books keep a bottom strip free of music, so the folio can never
    #    be overprinted by (or clipped through) an edition's own furniture.
    bottom_reserve = FOLIO_RESERVE_PT if package.include_page_numbers else 0.0
    body_count = 0

    def _folio_at(body_index: int) -> int | None:
        """The printed folio the planner assigned to this body page."""
        if 0 <= body_index < len(layout.pages):
            return layout.pages[body_index].folio
        return None

    for planned in plan:
        item_id = str(planned.item.pk)
        if planned.leading_blank:
            writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
            _map(KIND_SPACER, folio=None, item=item_id)
            body_count += 1
        if planned.card_bytes is not None:
            for _ in range(_append_pages(writer, planned.card_bytes)):
                _map(KIND_CARD, folio=_folio_at(body_count), item=item_id)
                body_count += 1
        if planned.reader is not None:
            end = planned.start_index + planned.bound_page_count
            for offset, source_page in enumerate(planned.reader.pages[planned.start_index:end]):
                placed = _place_on_a4(
                    writer, source_page, fit=package.normalize_to_a4,
                    bottom_reserve_pt=bottom_reserve,
                    masks=planned.source_masks.get(planned.start_index + offset),
                )
                _map(
                    KIND_MUSIC,
                    folio=_folio_at(body_count),
                    item=item_id,
                    edition=str(planned.edition.pk) if planned.edition else None,
                    # 1-based within the edition, so it lines up with what the
                    # annotation editor stores as ``page_number``.
                    src_page=planned.start_index + offset + 1,
                    box=list(placed) if placed else None,
                )
                body_count += 1

    # 5) Page numbers on the body only (front matter stays unnumbered). Duplex puts
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

    # No marks are drawn here, whatever `include_markings` says. The reader in
    # the app draws every layer live over these pages, so ink in the file would
    # be drawn twice there; a copy leaving the app has its marks composed when it
    # is served (see `roster.views._requested_mark_layers`).

    # 6) Navigable outline (anchors at physical offsets, past any front pad).
    if package.include_bookmarks:
        _add_outline(writer, package, body_start, plan)

    buffer = BytesIO()
    writer.write(buffer)

    return BuildResult(
        pdf_bytes=buffer.getvalue(),
        page_count=body_start + body_count,
        bound_pieces=sum(1 for p in plan if not p.is_placeholder),
        skipped_titles=[p.title for p in plan if p.is_placeholder],
        page_map=page_map,
    )


def render_item_card_preview(project: Project, package: ScorePackage, item: ProgramItem) -> bytes:
    """Render just one program item's card to a PDF — the cockpit's live "preview
    this card" affordance. Uses the same context builder, the same density and the
    same language as the full assembly, so what the conductor sees is what the book
    gets."""
    with _book_language():
        return _render_item_card(project, package, item)


def _render_item_card(project: Project, package: ScorePackage, item: ProgramItem) -> bytes:
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
    # The preview reads the whole programme for one card, on purpose: a slot used
    # twice is numbered against its siblings, and a preview that says "Na Komunię"
    # where the book will say "Na Komunię 2" is worse than no preview at all.
    siblings = list(
        ProgramItem.objects.filter(project=project).order_by("order")
    )
    presentations = dict(
        zip(
            (sibling.pk for sibling in siblings),
            build_program_presentation(siblings),
            strict=True,
        )
    )
    context = _card_context(
        planned, config, package, project,
        page_label=_stored_card_label(package, item),
        presentation=presentations[item.pk],
    )
    # Mass density prints no frontispiece for a bound piece — its text flows into
    # the consolidated "Teksty i tłumaczenia" section — so previewing one as a
    # full page would show a card the book will never contain. A placeholder keeps
    # the frontispiece in either density: the divider IS what Mass prints for a
    # piece whose music has not arrived.
    mass_entry = (
        package.density_mode == ScorePackage.Density.MASS and not planned.is_placeholder
    )
    if mass_entry:
        return _render_cards([context], section_header=TEXTS_SECTION_HEADER)
    # The same fitting the assembly runs, so the preview breaks where the book will.
    pdf, _pages = _fit_card(context)
    return pdf


__all__ = [
    "BuildResult",
    "DocumentRenderDependencyError",
    "ScorePackageBuildError",
    "build_score_package",
    "render_item_card_preview",
]
