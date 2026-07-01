"""
@file score_package_config.py
@description Single source of truth for the score-book's per-item content
    resolution: which card elements exist, how a program item's overrides fold
    onto the package defaults, which edition binds, and which translation /
    programme note is chosen. Pure domain logic — no PDF/AI deps — so it can be
    imported by the builder, the readiness engine, the service and the views
    without dragging in WeasyPrint/pypdf.
@architecture Enterprise SaaS 2026
@module roster/score_package_config
"""

from __future__ import annotations

from dataclasses import dataclass

from archive.models import Piece, ProgramNote, ScoreEdition, Translation
from archive.services.language import normalize_language
from roster.models import ProgramItem, Project, ScorePackage

# Canonical, ordered set of toggleable card elements. Title + composer + arranger
# are structural (a frontispiece is the divider — it always carries them) and are
# deliberately NOT in this list. Order here is the order the cockpit renders the
# checkboxes in — which mirrors top-to-bottom order on the printed card.
CARD_ELEMENTS: tuple[str, ...] = (
    "eyebrow",      # section / text-source line above the title
    "meta",         # voicing · language · duration strip
    "cast",         # concert-specific performers line (per-item, opt-in like ipa)
    "movements",    # movement list for cyclic works (opt-in like ipa)
    "text",         # original sung text
    "translation",  # translation in the package language
    "note",         # short programme note
    "ipa",          # IPA pronunciation aid
)
_CARD_ELEMENTS_SET: frozenset[str] = frozenset(CARD_ELEMENTS)


@dataclass(frozen=True)
class ResolvedCardConfig:
    """A program item's effective card settings after folding its overrides."""

    enabled: bool
    elements: frozenset[str]

    def shows(self, element: str) -> bool:
        return self.enabled and element in self.elements


def package_default_elements(package: ScorePackage) -> frozenset[str]:
    """The book-wide default element set (the default for every item that has not
    pinned its own ``card_elements``). Read straight off ``card_default_elements``,
    coerced to the canonical vocabulary — so the global settings and the per-item
    override speak the exact same element language."""
    return frozenset(sanitize_card_elements(package.card_default_elements) or ())


def resolve_card_config(item: ProgramItem, package: ScorePackage) -> ResolvedCardConfig:
    """Fold a program item's per-item overrides onto the package defaults."""
    enabled = package.include_cards if item.card_enabled is None else bool(item.card_enabled)
    if item.card_elements is None:
        elements = package_default_elements(package)
    else:
        elements = frozenset(e for e in item.card_elements if e in _CARD_ELEMENTS_SET)
    return ResolvedCardConfig(enabled=enabled, elements=elements)


def sanitize_card_elements(value: object) -> list[str] | None:
    """Coerce a client-supplied card-element list to the canonical subset,
    preserving the canonical order. ``None``/invalid input yields ``None``
    (= inherit the package default)."""
    if value is None:
        return None
    if not isinstance(value, (list, tuple)):
        return None
    chosen = {str(v) for v in value}
    return [e for e in CARD_ELEMENTS if e in chosen]


# ---------------------------------------------------------------------------
# Edition resolution
# ---------------------------------------------------------------------------

def _auto_select(active_editions: list[ScoreEdition]) -> ScoreEdition | None:
    """The default edition first, otherwise the most recently created one with a
    file. Mirrors the call-sheet generator so the two stay consistent."""
    if not active_editions:
        return None
    return sorted(
        active_editions,
        key=lambda e: (0 if e.is_default else 1, -(e.created_at.timestamp() if e.created_at else 0.0)),
    )[0]


def active_editions(piece: Piece) -> list[ScoreEdition]:
    """The piece's non-deleted editions that actually carry a PDF file. Relies on
    ``piece.editions`` being prefetched with the active manager."""
    return [e for e in piece.editions.all() if e.pdf_file]


def select_edition(piece: Piece) -> ScoreEdition | None:
    """Auto-select the edition to bind for a piece (no per-item override)."""
    return _auto_select(active_editions(piece))


def resolve_item_edition(item: ProgramItem) -> ScoreEdition | None:
    """Resolve which edition binds for a program item: the conductor's explicit
    pick when it is still a live, file-bearing edition of this piece, otherwise
    the auto-selected default."""
    editions = active_editions(item.piece)
    if item.score_edition_id:
        for edition in editions:
            if edition.pk == item.score_edition_id:
                return edition
    return _auto_select(editions)


# ---------------------------------------------------------------------------
# Translation / programme-note selection
# ---------------------------------------------------------------------------

def translation_applicable(piece: Piece, language: str) -> bool:
    """Whether a translation column makes sense at all: only when the sung text
    is (at least partly) in a language other than the book's. A Polish piece in
    a Polish book has nothing to translate — that is "not applicable", never
    "missing". ``Piece.language`` may be a normalized ISO 639-1 code, a legacy
    free-text value ("Latin"), or a '+'-joined bilingual set ('pl+la'); an
    unknown/blank language keeps the translation applicable (warn, never hide)."""
    normalized = normalize_language(piece.language)
    if not normalized:
        return True
    target = (language or "").strip().lower()
    return any(code != target for code in normalized.split("+"))


def select_translation(piece: Piece, language: str) -> Translation | None:
    """Piece-level translation in ``language``, preferring a literal (non-singable)
    one — the literal text serves comprehension better than a singable paraphrase."""
    lang = language.lower()
    candidates = [
        t for t in piece.translations.all()
        if t.movement_id is None and (t.target_language or "").lower() == lang
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda t: 0 if not t.is_singable else 1)
    return candidates[0]


def resolve_item_translation(item: ProgramItem, language: str) -> Translation | None:
    """Resolve the translation printed on an item's card. The conductor's explicit
    pick wins when it is still a live piece-level translation of this piece — a
    manual pin also overrides the not-applicable heuristic, because deliberate
    intent is trusted (mirrors how overrides are trusted elsewhere). Otherwise
    the auto-selected translation in the package language, suppressed entirely
    when a translation is not applicable."""
    if item.translation_id:
        for candidate in item.piece.translations.all():
            if candidate.pk == item.translation_id and candidate.movement_id is None:
                return candidate
    if not translation_applicable(item.piece, language):
        return None
    return select_translation(item.piece, language)


def pinnable_translations(piece: Piece) -> list[Translation]:
    """Piece-level translations the cockpit's picker can pin, any language —
    movement-scoped fragments are excluded (the card prints whole-piece text)."""
    return [t for t in piece.translations.all() if t.movement_id is None]


def movement_titles(piece: Piece) -> list[str]:
    """Movement list for a cyclic work's card ('1. Kyrie' …). Empty for works with
    fewer than two movements — a lone movement IS the piece, listing it is noise."""
    movements = sorted(piece.movements.all(), key=lambda m: m.order_index)
    if len(movements) < 2:
        return []
    return [f"{m.order_index + 1}. {m.title}".strip(" .") for m in movements]


def select_program_note(piece: Piece, project: Project, language: str) -> ProgramNote | None:
    """Programme note in ``language``, preferring this project's note, then an
    approved one."""
    lang = language.lower()
    notes = [n for n in piece.program_notes.all() if (n.language or "").lower() == lang]
    if not notes:
        return None
    notes.sort(key=lambda n: (0 if n.project_id == project.pk else 1, 0 if n.is_approved else 1))
    return notes[0]


def composer_label(piece: Piece) -> str:
    """Compact composer line for TOC/cockpit rows: name, with arranger appended."""
    composer = piece.composer
    name = f"{composer.first_name} {composer.last_name}".strip() if composer else ""
    if piece.arranger:
        return f"{name} · arr. {piece.arranger}".strip(" ·") if name else f"arr. {piece.arranger}"
    return name


def edition_label(edition: ScoreEdition) -> str:
    """Human label for an edition in the cockpit's picker."""
    parts: list[str] = []
    if edition.publisher:
        parts.append(edition.publisher)
    if edition.edition_year:
        parts.append(str(edition.edition_year))
    label = " · ".join(parts) if parts else (edition.original_filename or "Wydanie")
    if edition.page_count:
        label = f"{label} ({edition.page_count} s.)"
    return label


def suggested_page_start(piece: Piece) -> int | None:
    """The page the music first begins on (AI-detected via Movement.starts_on_page),
    used to suggest trimming the publisher's front matter. ``None`` when there is
    nothing to trim (music already starts on page 1, or no movement data)."""
    starts = [m.starts_on_page for m in piece.movements.all() if m.starts_on_page]
    if not starts:
        return None
    first = min(starts)
    return first if first > 1 else None


__all__ = [
    "CARD_ELEMENTS",
    "ResolvedCardConfig",
    "active_editions",
    "composer_label",
    "edition_label",
    "movement_titles",
    "package_default_elements",
    "pinnable_translations",
    "resolve_card_config",
    "resolve_item_edition",
    "resolve_item_translation",
    "sanitize_card_elements",
    "select_edition",
    "select_program_note",
    "select_translation",
    "suggested_page_start",
    "translation_applicable",
]
