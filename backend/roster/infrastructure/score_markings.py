"""
@file score_markings.py
@description Prints score markings onto an assembled score book. Reads the
    package's page map to learn where each edition page landed on its A4 sheet,
    renders one WeasyPrint overlay carrying every mark that falls on a bound
    page, and merges it onto the stored PDF. Used twice: at build time for the
    conductor's ``shared`` layer (baked into the book every choir member gets)
    and at serve time for one reader's ``personal`` layer (composed per download,
    never stored).

    **Screen and paper are not the same medium**, so two marks are deliberately
    translated rather than copied:

    * A highlighter stroke is a translucent band multiplied over the notes. On a
      monochrome printer that is grey mush across the noteheads, so in print it
      becomes an UNDERLINE tracing the same gesture — the passage is still
      marked, the music is still readable (print canon: verify on mono).
    * A pinned comment shows only a dot on screen, its text behind a tap. Paper
      has no tap, so a pin prints its text as well, in a smaller chip than an
      inline note. A mark that says nothing on paper is not a mark.

    And because colour does not survive a laser printer with no toner colours,
    the conductor's ink prints HEAVIER than a reader's own pencil: the two layers
    stay distinguishable in grey.
@architecture Enterprise SaaS 2026
@module roster/infrastructure/score_markings
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from html import escape
from io import BytesIO
from math import ceil
from typing import Any

from pypdf import PdfReader, PdfWriter

from archive.annotation_stamps import get_stamp
from roster.infrastructure.document_generator import _render_pdf
from roster.infrastructure.print_fonts import BOOK_FONT_STACK, font_face_css
from roster.score_page_map import (
    A4_HEIGHT_PT,
    A4_WIDTH_PT,
    PlacedBox,
    music_pages,
    normalized_to_sheet,
)

logger = logging.getLogger(__name__)

# Annotation type codes (archive.models.AnnotationType), repeated as plain
# strings so the renderer stays usable without the ORM.
_HIGHLIGHT = "HL"
_COMMENT = "CM"
_FREEHAND = "FH"
_STAMP = "ST"

# Layers whose ink is the conductor speaking to the choir; they print heavier so
# they remain separable from a reader's own marks on a monochrome printout.
_HEAVY_LAYERS = frozenset({"shared", "conductor"})
_HEAVY_FACTOR = 1.4

# Ink used when a stored colour cannot be parsed — the palette's near-black.
_FALLBACK_INK = "#1F2933"

# Print floors, in points: below these a stroke stops being visible on paper
# whatever the screen showed.
_MIN_PEN_PT = 0.5
_MIN_UNDERLINE_PT = 0.7
# ...and a ceiling for the underline alone. The band's width on screen says how
# much was swept, not how loud the marking is, so a bold sweep must not print a
# bar heavier than the engraving. Applied BEFORE the layer weight, so a
# conductor's underline still prints heavier than a reader's on the same passage.
_MAX_UNDERLINE_PT = 2.0

# An inline note's font size as a fraction of the placed page width (mirrors the
# editor's on-screen ratio), clamped to what is legible but not overbearing.
_NOTE_SIZE_FRACTION = 0.026
_NOTE_MIN_PT = 6.0
_NOTE_MAX_PT = 16.0
# A pin's text is a marginal aside, not a caption over the notes.
_PIN_SIZE_FACTOR = 0.8

# Width of the invisible box each chip/glyph is centred in. Plain block layout
# with `text-align: center` rather than a percentage transform: it centres the
# mark on its point in every renderer, with nothing to measure first.
_ANCHOR_WIDTH_PT = 240.0
# The anchor box carries no font of its own (`font-size: 0; line-height: 0`), so
# its line box is exactly as tall as the chip inside it and the chip's top edge
# lands on the box's top edge. That is what lets the vertical centring be
# ARITHMETIC — `top = y - height/2` — instead of a guess about where a strut's
# baseline falls. Every number below therefore has to match the CSS in
# `_overlay_html`; they are one decision written twice.
_CHIP_MAX_WIDTH_PT = 200.0   # .note max-width — where a long comment wraps
_CHIP_LINE_HEIGHT = 1.15     # .note line-height
_CHIP_FRAME_PT = 1.8         # .note padding (0.5pt) + border (0.4pt), both edges
# Gentium Plus averages a little under half an em per character in running text.
# Only a comment long enough to wrap uses this, and the worst case is half a line
# of drift on a mark that is an aside anyway.
_AVG_ADVANCE_EM = 0.5


@dataclass(frozen=True)
class PrintMark:
    """One mark to draw, decoupled from the ORM so the renderer is pure."""

    annotation_type: str
    payload: dict[str, Any]
    color: str
    heavy: bool


def marks_from_annotations(annotations: Iterable[Any]) -> dict[tuple[str, int], list[PrintMark]]:
    """Group annotation rows by the source page they were drawn on, which is how
    the page map addresses them: ``(edition id, 1-based page number)``.

    The caller decides WHICH annotations arrive here — that is where the layer
    rules live, and this function must never be the thing that widens them."""
    grouped: dict[tuple[str, int], list[PrintMark]] = {}
    for annotation in annotations:
        payload = annotation.payload
        if not isinstance(payload, dict):
            continue
        key = (str(annotation.edition_id), int(annotation.page_number))
        grouped.setdefault(key, []).append(PrintMark(
            annotation_type=annotation.annotation_type,
            payload=payload,
            color=annotation.color,
            heavy=annotation.layer_name in _HEAVY_LAYERS,
        ))
    return grouped


def _ink(raw: str) -> tuple[str, float]:
    """Split a stored ``#RRGGBB`` / ``#RRGGBBAA`` colour into a 6-digit hex and an
    opacity. The alpha is applied as an SVG/CSS opacity rather than passed through
    as an 8-digit hex, which not every consumer of this markup parses."""
    value = (raw or "").strip()
    if not value.startswith("#"):
        return _FALLBACK_INK, 1.0
    digits = value[1:]
    if len(digits) == 6:
        candidate, alpha = digits, 1.0
    elif len(digits) == 8:
        candidate, alpha = digits[:6], int(digits[6:], 16) / 255 if _is_hex(digits[6:]) else 1.0
    else:
        return _FALLBACK_INK, 1.0
    if not _is_hex(candidate):
        return _FALLBACK_INK, 1.0
    return f"#{candidate}", alpha


def _is_hex(value: str) -> bool:
    return all(c in "0123456789abcdefABCDEF" for c in value)


def _points(path: Any, box: PlacedBox) -> list[tuple[float, float]]:
    """Map one stored stroke's normalized points onto the sheet."""
    result: list[tuple[float, float]] = []
    if not isinstance(path, (list, tuple)):
        return result
    for point in path:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            continue
        try:
            result.append(normalized_to_sheet(box, float(point[0]), float(point[1])))
        except (TypeError, ValueError):
            continue
    return result


def _smooth_path(points: Sequence[tuple[float, float]], dy: float = 0.0) -> str:
    """Catmull-Rom → cubic Bézier, the same curve the editor draws on screen, so
    a stroke does not change shape between the tablet and the page. ``dy`` shifts
    the whole curve down the sheet (how a highlight becomes an underline)."""
    if not points:
        return ""
    px = [(x, y + dy) for x, y in points]
    if len(px) == 1:
        return f"M {px[0][0]:.2f} {px[0][1]:.2f} l 0.1 0.1"
    if len(px) == 2:
        return f"M {px[0][0]:.2f} {px[0][1]:.2f} L {px[1][0]:.2f} {px[1][1]:.2f}"

    parts = [f"M {px[0][0]:.2f} {px[0][1]:.2f}"]
    for index in range(len(px) - 1):
        p0 = px[index - 1] if index > 0 else px[index]
        p1 = px[index]
        p2 = px[index + 1]
        p3 = px[index + 2] if index + 2 < len(px) else p2
        c1x = p1[0] + (p2[0] - p0[0]) / 6
        c1y = p1[1] + (p2[1] - p0[1]) / 6
        c2x = p2[0] - (p3[0] - p1[0]) / 6
        c2y = p2[1] - (p3[1] - p1[1]) / 6
        parts.append(
            f"C {c1x:.2f} {c1y:.2f}, {c2x:.2f} {c2y:.2f}, {p2[0]:.2f} {p2[1]:.2f}"
        )
    return " ".join(parts)


def _stroke_width(payload: dict[str, Any], box: PlacedBox, default: float) -> float:
    """The stored width fraction resolved against the placed page width."""
    try:
        fraction = float(payload.get("width", default))
    except (TypeError, ValueError):
        fraction = default
    return max(0.0, fraction) * box[2]


def _scale(payload: dict[str, Any]) -> float:
    try:
        value = float(payload.get("scale", 1.0))
    except (TypeError, ValueError):
        return 1.0
    return min(4.0, max(0.2, value))


def _render_freehand(mark: PrintMark, box: PlacedBox) -> str:
    fill, alpha = _ink(mark.color)
    width = _stroke_width(mark.payload, box, 0.004)
    width = max(_MIN_PEN_PT, width * (_HEAVY_FACTOR if mark.heavy else 1.0))
    out: list[str] = []
    for path in mark.payload.get("paths") or []:
        d = _smooth_path(_points(path, box))
        if d:
            out.append(
                f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{width:.2f}"'
                f' stroke-opacity="{alpha:.3f}" stroke-linecap="round" stroke-linejoin="round"/>'
            )
    return "".join(out)


def _render_highlight(mark: PrintMark, box: PlacedBox) -> str:
    """A highlighter band, printed as the underline it has to become. The curve is
    dropped by half the band so it runs UNDER the passage the singer swept over,
    not through the noteheads."""
    fill, alpha = _ink(mark.color)
    band = _stroke_width(mark.payload, box, 0.021)
    hairline = min(_MAX_UNDERLINE_PT, max(_MIN_UNDERLINE_PT, band * 0.16))
    width = hairline * (_HEAVY_FACTOR if mark.heavy else 1.0)
    out: list[str] = []
    for path in mark.payload.get("paths") or []:
        d = _smooth_path(_points(path, box), dy=band / 2)
        if d:
            out.append(
                f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{width:.2f}"'
                f' stroke-opacity="{alpha:.3f}" stroke-linecap="round" stroke-linejoin="round"/>'
            )
    return "".join(out)


def _mark_anchor(payload: dict[str, Any], box: PlacedBox) -> tuple[float, float] | None:
    try:
        return normalized_to_sheet(box, float(payload["x"]), float(payload["y"]))
    except (KeyError, TypeError, ValueError):
        return None


def _render_svg_stamp(mark: PrintMark, box: PlacedBox) -> str:
    """A geometric stamp (fermata, hairpin, the 'watch me' glasses) drawn in the
    page-level SVG, its viewBox scaled to the stamp's share of the page width."""
    stamp = get_stamp(str(mark.payload.get("symbol", "")))
    if stamp is None or stamp.is_text:
        return ""
    anchor = _mark_anchor(mark.payload, box)
    if anchor is None:
        return ""
    fill, alpha = _ink(mark.color)
    width_pt = stamp.size_fraction * box[2] * _scale(mark.payload)
    view_parts = stamp.view_box.split()
    try:
        view_width = float(view_parts[2])
    except (IndexError, ValueError):
        return ""
    if view_width <= 0:
        return ""
    factor = width_pt / view_width
    left = anchor[0] - width_pt / 2
    top = anchor[1] - (width_pt * stamp.aspect) / 2
    pen = 2.0 * (_HEAVY_FACTOR if mark.heavy else 1.0)
    body = "".join(
        f'<path d="{escape(d)}" fill="none" stroke="{fill}" stroke-width="{pen:.2f}"'
        f' stroke-linecap="round" stroke-linejoin="round"/>'
        for d in stamp.paths
    )
    if stamp.dot:
        body += (
            f'<circle cx="{stamp.dot[0]}" cy="{stamp.dot[1]}" r="{stamp.dot[2]}" fill="{fill}"/>'
        )
    return (
        f'<g opacity="{alpha:.3f}" transform="translate({left:.2f} {top:.2f})'
        f' scale({factor:.4f})">{body}</g>'
    )


def _anchor_html(anchor: tuple[float, float], height: float, body: str) -> str:
    """Place a chip of known height centred on its point.

    The editor anchors a note or a stamp by its CENTRE (``translate(-50%, -50%)``
    on screen), so print has to do the same or a mark drawn between two staves
    prints across the notes. Horizontally that is ``text-align: center`` in a
    fixed-width box; vertically it is this subtraction, which is why every chip
    has to be able to state its own height.
    """
    return (
        f'<div class="an" style="left:{anchor[0] - _ANCHOR_WIDTH_PT / 2:.2f}pt;'
        f'top:{anchor[1] - height / 2:.2f}pt">{body}</div>'
    )


def _note_chip_height(text: str, size: float) -> float:
    """How tall the note chip will print, derived from the CSS above rather than
    measured: a single-line chip — nearly every one — is exact, and a comment long
    enough to wrap is estimated from the average advance width."""
    per_line = max(1.0, _CHIP_MAX_WIDTH_PT / (size * _AVG_ADVANCE_EM))
    lines = max(1, ceil(len(text) / per_line))
    return lines * _CHIP_LINE_HEIGHT * size + _CHIP_FRAME_PT


def _render_text_stamp(mark: PrintMark, box: PlacedBox) -> str:
    stamp = get_stamp(str(mark.payload.get("symbol", "")))
    if stamp is None or not stamp.is_text:
        return ""
    anchor = _mark_anchor(mark.payload, box)
    if anchor is None:
        return ""
    fill, alpha = _ink(mark.color)
    size = stamp.size_fraction * box[2] * _scale(mark.payload)
    weight = "700" if mark.heavy else "400"
    chip = (
        f'<span class="dyn" style="font-size:{size:.2f}pt;color:{fill};'
        f'opacity:{alpha:.3f};font-weight:{weight}">{escape(stamp.glyph)}</span>'
    )
    # `.dyn` has line-height 1, so the glyph's box is exactly one em tall.
    return _anchor_html(anchor, size, chip)


def _render_comment(mark: PrintMark, box: PlacedBox) -> str:
    text = str(mark.payload.get("text") or "").strip()
    if not text:
        return ""
    anchor = _mark_anchor(mark.payload, box)
    if anchor is None:
        return ""
    fill, alpha = _ink(mark.color)
    base = min(_NOTE_MAX_PT, max(_NOTE_MIN_PT, box[2] * _NOTE_SIZE_FRACTION))
    size = base * _scale(mark.payload)
    if mark.payload.get("display") != "inline":
        size *= _PIN_SIZE_FACTOR
    weight = "700" if mark.heavy else "600"
    chip = (
        f'<span class="note" style="font-size:{size:.2f}pt;color:{fill};'
        f'opacity:{alpha:.3f};font-weight:{weight}">{escape(text)}</span>'
    )
    return _anchor_html(anchor, _note_chip_height(text, size), chip)


def _render_page(marks: Sequence[tuple[PrintMark, PlacedBox]]) -> str:
    """One overlay sheet: strokes and geometric stamps in a page-sized SVG,
    text chips as positioned HTML above it."""
    svg_parts: list[str] = []
    html_parts: list[str] = []
    # Highlights first so ink and text sit above them, mirroring the editor's
    # own stacking order.
    for mark, box in marks:
        if mark.annotation_type == _HIGHLIGHT:
            svg_parts.append(_render_highlight(mark, box))
    for mark, box in marks:
        if mark.annotation_type == _FREEHAND:
            svg_parts.append(_render_freehand(mark, box))
        elif mark.annotation_type == _STAMP:
            svg_parts.append(_render_svg_stamp(mark, box))
            html_parts.append(_render_text_stamp(mark, box))
        elif mark.annotation_type == _COMMENT:
            html_parts.append(_render_comment(mark, box))
    svg = (
        f'<svg class="ink" viewBox="0 0 {A4_WIDTH_PT:.4f} {A4_HEIGHT_PT:.4f}">'
        f'{"".join(svg_parts)}</svg>'
    )
    return f'<div class="pg">{svg}{"".join(html_parts)}</div>'


def _overlay_html(pages: Sequence[Sequence[tuple[PrintMark, PlacedBox]]]) -> str:
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
        + font_face_css()
        + "@page { size: A4; margin: 0; }"
        ".pg { position: relative; width: 210mm; height: 297mm; }"
        ".pg:not(:first-child) { break-before: page; }"
        ".ink { position: absolute; left: 0; top: 0; width: 210mm; height: 297mm; }"
        # No font of its own: an empty strut would push the chip below its point
        # by the anchor box's own ascent, which is what `_anchor_html` relies on
        # not happening.
        f".an {{ position: absolute; width: {_ANCHOR_WIDTH_PT}pt; text-align: center;"
        " font-size: 0; line-height: 0; }"
        f".note {{ font-family: {BOOK_FONT_STACK}; line-height: {_CHIP_LINE_HEIGHT};"
        f" display: inline-block; max-width: {_CHIP_MAX_WIDTH_PT}pt;"
        " padding: 0.5pt 2pt; background: #ffffff;"
        " border: 0.4pt solid rgba(0,0,0,0.25); border-radius: 2pt; }"
        f".dyn {{ font-family: {BOOK_FONT_STACK}; font-style: italic;"
        " line-height: 1; display: inline-block; }"
        "</style></head><body>"
        + "".join(_render_page(page) for page in pages)
        + "</body></html>"
    )


def plan_markings(
    page_map: list[Any],
    marks_by_source: dict[tuple[str, int], list[PrintMark]],
) -> list[tuple[int, list[tuple[PrintMark, PlacedBox]]]]:
    """Resolve which book pages carry which marks, in page order.

    A mark lands wherever its source page was bound — including twice, if two
    program items bind the same edition page. Marks on pages the book trimmed
    away simply have nowhere to go; the readiness engine is what warns about
    those, because silently dropping them is exactly the failure this feature
    must not have.
    """
    planned: list[tuple[int, list[tuple[PrintMark, PlacedBox]]]] = []
    if not marks_by_source:
        return planned
    for row in music_pages(page_map):
        box = row.get("box")
        edition = row.get("edition")
        src_page = row.get("src_page")
        if box is None or edition is None or src_page is None:
            continue
        found = marks_by_source.get((edition, src_page))
        if not found:
            continue
        placed: PlacedBox = (box[0], box[1], box[2], box[3])
        planned.append((row["phys"], [(mark, placed) for mark in found]))
    return planned


def render_overlay_pages(
    planned: Sequence[tuple[int, list[tuple[PrintMark, PlacedBox]]]],
) -> list[Any]:
    """One WeasyPrint render for the whole book, returning the overlay sheets in
    the same order as ``planned``. Only pages that actually carry marks become
    sheets, so a 200-page book with three marked bars renders three."""
    overlay_bytes = _render_pdf(_overlay_html([marks for _, marks in planned]))
    return list(PdfReader(BytesIO(overlay_bytes)).pages)


def merge_overlay(
    writer: PdfWriter,
    planned: Sequence[tuple[int, list[tuple[PrintMark, PlacedBox]]]],
) -> int:
    """Draw the planned marks onto the pages a writer already holds. Returns how
    many sheets landed."""
    if not planned:
        return 0
    sheets = render_overlay_pages(planned)
    if len(sheets) != len(planned):
        # The overlay is matched to the book by ORDER, so a renderer that emitted
        # a stray sheet would land every mark after it on the wrong page. A book
        # missing its markings is a re-run; a book with the conductor's cue over
        # the wrong bar is a rehearsal going wrong.
        logger.error(
            "score_markings.overlay_page_mismatch sheets=%s planned=%s",
            len(sheets), len(planned),
        )
        return 0
    total = len(writer.pages)
    merged = 0
    for (phys, _), sheet in zip(planned, sheets, strict=False):
        if 0 <= phys < total:
            writer.pages[phys].merge_page(sheet)
            merged += 1
        else:
            # The map outlived the file it describes — draw nothing rather than
            # ink on a page that means something else now.
            logger.warning("score_markings.page_out_of_range phys=%s pages=%s", phys, total)
    return merged


def apply_markings(
    pdf_bytes: bytes,
    page_map: list[Any],
    marks_by_source: dict[tuple[str, int], list[PrintMark]],
) -> bytes:
    """Return ``pdf_bytes`` with every applicable mark drawn on it.

    Returns the input untouched when there is nothing to draw, so a caller may
    invoke it unconditionally on a book that may carry no marks at all.
    """
    planned = plan_markings(page_map, marks_by_source)
    if not planned:
        return pdf_bytes

    writer = PdfWriter()
    writer.append(PdfReader(BytesIO(pdf_bytes)))
    merge_overlay(writer, planned)

    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


__all__ = [
    "PrintMark",
    "apply_markings",
    "marks_from_annotations",
    "merge_overlay",
    "plan_markings",
    "render_overlay_pages",
]
