"""
@file score_source_numbering.py
@description Detects an edition's OWN printed page numbers so the score-book
    builder can knock them out. A bound book stamps its own continuous folio
    (see score_package_layout); leaving the publisher's numbering underneath it
    puts two competing numbering systems on one page — and because the source is
    scaled and re-centred onto A4, the publisher's number lands a millimetre or
    two above the book's, reading as one number stacked on another.

    Detection is evidence-based, never a fixed "erase this band" rule: a position
    is only accepted once the values printed there step by exactly +1 from page
    to page across several pages. That running sequence is what a folio is, and
    it is precisely what rehearsal marks and measure numbers are not (those climb
    by the bar count of a page, never by one). Evidence is gathered across the
    whole edition, so a two-page motet trimmed out of a longer score is still
    covered by its neighbours' proof.

    Text-layer only — a pure scan yields nothing and its pages are left
    untouched, which is the correct failure mode: no detection is better than a
    white patch over engraving.
@architecture Enterprise SaaS 2026
@module roster/infrastructure/score_source_numbering
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from itertools import pairwise

from pypdf import PdfReader

logger = logging.getLogger(__name__)

# A folio lives in the page's outer furniture, never in the engraved system.
# 14% of the sheet height is generous enough for a wide-margin octavo edition and
# still well clear of the first/last staff on any realistic vocal score.
_BAND_FRACTION: float = 0.14

# Folios are short. Anything longer is a running head, a copyright line or a
# plate number — all of which we must leave alone.
_MAX_FOLIO_CHARS: int = 5

# How far apart two occurrences may sit and still count as "the same position".
# Editions jitter by a point or two between pages.
_POSITION_TOLERANCE_PT: float = 8.0

# A running sequence must prove itself over this many pages before we cover
# anything. Three is the smallest count that distinguishes "+1 each page" from a
# coincidence of two numbers that happen to differ by one.
_MIN_SEQUENCE_PAGES: int = 3

# Ceiling on pages scanned for evidence. A folio proves itself in the first
# handful of pages; scanning a 300-page anthology in full would cost far more
# than it buys.
_MAX_EVIDENCE_PAGES: int = 64

# Padding around the detected glyph box, so a descender, a surrounding rule or a
# dot leader does not survive at the edge of the knockout.
_MASK_PADDING_PT: float = 2.5

# Arabic or roman folio, optionally dressed with dashes, dots, brackets or a
# leading page abbreviation ("- 12 -", "[iv]", "s. 7").
_FOLIO_RE = re.compile(
    r"^[\[(\-–—\s.]*(?:s\.?|p\.?|str\.?)?\s*"  # noqa: RUF001 - en/em dash are the real characters editions print
    r"(?P<value>\d{1,4}|[ivxlcdm]{1,8})"
    r"[\])\-–—\s.]*$",  # noqa: RUF001
    re.IGNORECASE,
)

_ROMAN_VALUES = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}


@dataclass(frozen=True)
class FolioBox:
    """One detected page number, in the SOURCE page's own PDF points."""

    left: float
    bottom: float
    right: float
    top: float


@dataclass(frozen=True)
class _Candidate:
    """A folio-shaped run harvested from one page, before any sequence proof."""

    page_index: int
    value: int
    left: float
    bottom: float
    right: float
    top: float
    band: str    # "top" or "bottom"
    side: str    # nearer sheet edge, "L" or "R" — an outer-corner folio mirrors
                 # between recto and verso and proves itself on each side


def _roman_to_int(text: str) -> int | None:
    """Parse a lowercase roman numeral, rejecting anything malformed."""
    total = 0
    previous = 0
    for char in reversed(text):
        value = _ROMAN_VALUES.get(char)
        if value is None:
            return None
        if value < previous:
            total -= value
        else:
            total += value
            previous = value
    return total if 0 < total < 4000 else None


def _parse_folio(text: str) -> int | None:
    """Numeric value of a folio-shaped string, or None when it is not one."""
    stripped = text.strip()
    if not stripped or len(stripped) > _MAX_FOLIO_CHARS:
        return None
    match = _FOLIO_RE.match(stripped)
    if match is None:
        return None
    raw = match.group("value")
    if raw.isdigit():
        value = int(raw)
        return value if 0 < value < 10_000 else None
    return _roman_to_int(raw.lower())


def _compose(tm: list[float], cm: list[float]) -> tuple[float, float, float, float]:
    """Compose the text matrix with the current transformation matrix, returning
    (x, y, x_scale, y_scale) in page space. pypdf hands the visitor the two
    matrices separately; the glyph's position on the sheet is their product."""
    a = tm[0] * cm[0] + tm[1] * cm[2]
    b = tm[0] * cm[1] + tm[1] * cm[3]
    c = tm[2] * cm[0] + tm[3] * cm[2]
    d = tm[2] * cm[1] + tm[3] * cm[3]
    e = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
    f = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
    return e, f, (a * a + b * b) ** 0.5, (c * c + d * d) ** 0.5


def _harvest_page(page, page_index: int) -> list[_Candidate]:
    """Every folio-shaped text run sitting in the page's top or bottom band."""
    box = page.mediabox
    width = float(box.width)
    height = float(box.height)
    origin_x = float(box.left)
    origin_y = float(box.bottom)
    if width <= 0 or height <= 0:
        return []

    band = height * _BAND_FRACTION
    found: list[_Candidate] = []

    def visitor(text, cm, tm, font_dict, font_size) -> None:
        value = _parse_folio(text or "")
        if value is None:
            return
        try:
            x, y, x_scale, y_scale = _compose(list(tm), list(cm))
        except (TypeError, IndexError, ValueError):
            return
        # Measured against the sheet's own edges, so a mediabox that does not
        # start at (0,0) still reads correctly.
        from_bottom = y - origin_y
        from_top = (origin_y + height) - y
        if from_bottom > band and from_top > band:
            return
        size = float(font_size or 0.0)
        if size <= 0:
            return
        # Glyph box from the baseline: digits advance ~0.55em and rise ~0.72em in
        # any text face a publisher would set a folio in.
        glyph_w = len(text.strip()) * 0.55 * size * x_scale
        left = x
        right = x + glyph_w
        side = "L" if (left - origin_x) <= ((origin_x + width) - right) else "R"
        found.append(_Candidate(
            page_index=page_index,
            value=value,
            left=left,
            bottom=y - 0.22 * size * y_scale,   # room for a descender below the baseline
            right=right,
            top=y + 0.72 * size * y_scale,
            band="bottom" if from_bottom <= band else "top",
            side=side,
        ))

    try:
        page.extract_text(visitor_text=visitor)
    except Exception as exc:  # a malformed page must never fail a build
        logger.warning("score_source_numbering.page_scan_failed page=%d err=%s", page_index, exc)
        return []
    return found


def _same_position(a: _Candidate, b: _Candidate) -> bool:
    """Whether two candidates occupy the same screen position.

    Either edge may anchor the match, because the folio's own alignment decides
    which one holds still: a right-aligned number keeps its right edge while its
    left creeps outward at 9→10, and a left-aligned one does the reverse. Testing
    only one edge would split a sequence in two at every digit-count change —
    and two half-length sequences each fail the proof, so nothing gets covered.
    """
    if a.band != b.band or a.side != b.side:
        return False
    if abs(a.bottom - b.bottom) > _POSITION_TOLERANCE_PT:
        return False
    return (
        abs(a.left - b.left) <= _POSITION_TOLERANCE_PT
        or abs(a.right - b.right) <= _POSITION_TOLERANCE_PT
    )


def _cluster(candidates: list[_Candidate]) -> list[list[_Candidate]]:
    """Group candidates that occupy the same screen position across pages.

    Greedy agglomeration against each group's first member rather than a fixed
    grid: a bucket boundary falling between two jittering occurrences would split
    one real sequence into two that are each too short to prove themselves.
    """
    groups: list[list[_Candidate]] = []
    for candidate in candidates:
        for group in groups:
            if _same_position(group[0], candidate):
                group.append(candidate)
                break
        else:
            groups.append([candidate])
    return groups


def _running_members(group: list[_Candidate]) -> list[_Candidate] | None:
    """The group's members if they form a running folio, else None.

    Requires one value per page (two numerals sharing a corner on one page is a
    coincidence, not a folio) and that the value advance matches the page
    advance on every step — so a page whose text layer drops the folio leaves a
    gap of two, and the values must jump by two to match.
    """
    per_page: dict[int, _Candidate] = {}
    for candidate in group:
        if candidate.page_index in per_page:
            return None
        per_page[candidate.page_index] = candidate
    if len(per_page) < _MIN_SEQUENCE_PAGES:
        return None

    ordered = sorted(per_page.values(), key=lambda c: c.page_index)
    for previous, current in pairwise(ordered):
        if current.page_index - previous.page_index != current.value - previous.value:
            return None
    return ordered


def _evidence_window(reader: PdfReader, page_indices: list[int]) -> list[int]:
    """Pages to scan for proof: the requested ones, widened with their
    neighbours up to the scan ceiling, so a short bound slice can still borrow
    the surrounding pages' evidence."""
    total = len(reader.pages)
    if total == 0:
        return []
    wanted = sorted({i for i in page_indices if 0 <= i < total})
    if not wanted:
        return []
    if total <= _MAX_EVIDENCE_PAGES:
        return list(range(total))
    # Centre the window on the requested slice.
    centre = (wanted[0] + wanted[-1]) // 2
    half = _MAX_EVIDENCE_PAGES // 2
    start = max(0, min(centre - half, total - _MAX_EVIDENCE_PAGES))
    return list(range(start, start + _MAX_EVIDENCE_PAGES))


def detect_source_folios(
    reader: PdfReader,
    page_indices: list[int],
) -> dict[int, list[FolioBox]]:
    """
    Find the edition's own printed page numbers and return the boxes to knock
    out, keyed by 0-based source page index.

    Boxes are in the page's own coordinate space, so the caller applies whatever
    placement transform it uses. Only pages in ``page_indices`` appear in the
    result — evidence is gathered more widely, but nothing outside the caller's
    range is masked. Pages with nothing proven are simply absent.
    """
    if not page_indices:
        return {}

    candidates: list[_Candidate] = []
    for index in _evidence_window(reader, page_indices):
        try:
            page = reader.pages[index]
        except IndexError:
            continue
        candidates.extend(_harvest_page(page, index))

    wanted = set(page_indices)
    masks: dict[int, list[FolioBox]] = {}
    for group in _cluster(candidates):
        members = _running_members(group)
        if members is None:
            continue
        logger.info(
            "score_source_numbering.detected band=%s side=%s pages=%d values=%d..%d",
            members[0].band, members[0].side, len(members),
            members[0].value, members[-1].value,
        )
        for candidate in members:
            if candidate.page_index not in wanted:
                continue
            masks.setdefault(candidate.page_index, []).append(FolioBox(
                left=candidate.left - _MASK_PADDING_PT,
                bottom=candidate.bottom - _MASK_PADDING_PT,
                right=candidate.right + _MASK_PADDING_PT,
                top=candidate.top + _MASK_PADDING_PT,
            ))
    return masks


__all__ = ["FolioBox", "detect_source_folios"]
