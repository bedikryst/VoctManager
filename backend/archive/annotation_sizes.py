"""
@file annotation_sizes.py
@description The size defaults and bounds a score mark is stored and printed
    with. Two readers take them from here: the write sanitizer
    (``archive.serializers.AnnotationSerializer``), which fills in what a payload
    leaves out, and the print overlay (``roster.infrastructure.score_markings``),
    which draws a stored row. One source, so the two cannot disagree on a
    default band or a size floor and print a mark at a size the editor never
    offered.

    Widths are fractions of the page width, the same normalized model the
    coordinates use. The editor always sends a width, so a default only fills
    in for a payload from elsewhere: the highlighter's is the editor's "medium"
    band (``HIGHLIGHT_WIDTHS`` in
    ``frontend/src/features/annotations/lib/useAnnotationTools.ts``), the pen's
    sits beside its medium nib.
@module archive/annotation_sizes
"""

from __future__ import annotations

#: A pen stroke's width when the payload names none.
DEFAULT_PEN_WIDTH = 0.004
#: A highlighter band's width when the payload names none.
DEFAULT_HIGHLIGHT_WIDTH = 0.021

#: Bounds of a text note's or a stamp's size multiplier (1.0 = as designed).
#: Wider than the editor's slider, so every value an older build stored stays
#: inside them.
MIN_MARK_SCALE = 0.4
MAX_MARK_SCALE = 4.0

__all__ = [
    "DEFAULT_HIGHLIGHT_WIDTH",
    "DEFAULT_PEN_WIDTH",
    "MAX_MARK_SCALE",
    "MIN_MARK_SCALE",
]
