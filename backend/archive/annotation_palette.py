"""
@file annotation_palette.py
@description The five inks a marking may be written in, which of them are the
    conductor's alone, and the highlighter's own colours.

    Colour stopped being decoration the moment two layers could print on one
    page: the choir's book carries the conductor's ``shared`` marks, and a
    singer's download can carry their own on top. If everyone draws in crimson,
    the page cannot say whose hand made which mark. So crimson is reserved — a
    manager may write it, a chorister may not, and their pencil defaults to the
    near-black that reads as a pencil.

    Colour is never the ONLY signal, because a laser printer with no toner
    colours would erase the distinction entirely: the print overlay also strokes
    the conductor's ink heavier (see ``roster/infrastructure/score_markings.py``).
    This module is the vocabulary; the print weight is the fallback.

    The highlighter writes in light marker colours that no other kind may use: a
    yellow pen line on white paper cannot be read. A highlight may still be in an
    ink, because every highlight written before these colours existed is. Print
    draws a highlight as an underline, and a pale one would vanish, so each
    highlighter colour names the darker sibling it prints in.

    The editor's copy of the palettes lives in
    ``frontend/src/features/annotations/lib/palette.ts``. A parity test asserts
    the lists match, because a swatch the editor offers and the server refuses
    is a mark a chorister cannot make and is never told why.
@module archive/annotation_palette
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Ink:
    """One writable colour. ``manager_only`` inks carry authority on the page."""

    value: str
    name: str
    manager_only: bool = False


@dataclass(frozen=True)
class HighlightInk:
    """One highlighter colour, and the darker one its underline prints in."""

    value: str
    name: str
    print_value: str


PALETTE: tuple[Ink, ...] = (
    Ink("#DC2626", "crimson", manager_only=True),  # the conductor's cue
    Ink("#2563EB", "cobalt"),
    Ink("#15803D", "verdigris"),
    Ink("#B45309", "gilt"),
    Ink("#1F2933", "graphite"),                    # a reader's pencil
)

HIGHLIGHTER: tuple[HighlightInk, ...] = (
    HighlightInk("#FFE14D", "yellow", print_value="#A16207"),        # dark gold
    HighlightInk("#FFB870", "light orange", print_value="#C2410C"),  # burnt orange
    HighlightInk("#A7E3A0", "light green", print_value="#15803D"),   # the green ink
    HighlightInk("#9CCFF5", "light blue", print_value="#2563EB"),    # the blue ink
)

#: What a mark is written in when the writer names no colour. Deliberately the
#: unreserved end of the palette: an unnamed ink must never be an authority one.
DEFAULT_INK: str = "#1F2933"

_BY_VALUE: dict[str, Ink] = {ink.value: ink for ink in PALETTE}
_HIGHLIGHT_BY_VALUE: dict[str, HighlightInk] = {ink.value: ink for ink in HIGHLIGHTER}


def _canonical(value: object) -> str:
    return str(value or "").strip().upper()


def normalize_ink(value: object, *, highlight: bool = False) -> str:
    """A stored colour in the palette's own casing, or '' for anything the
    palette does not contain. ``highlight`` admits the highlighter's colours
    too, which only a highlight may be written in. Case-insensitive: the wire
    format has never been guaranteed, and `#dc2626` is the same ink."""
    text = _canonical(value)
    if text in _BY_VALUE or (highlight and text in _HIGHLIGHT_BY_VALUE):
        return text
    return ""


def is_highlighter_ink(value: object) -> bool:
    """Whether this is one of the highlighter's own colours."""
    return _canonical(value) in _HIGHLIGHT_BY_VALUE


def highlight_print_ink(value: str) -> str:
    """The colour a highlight's underline prints in: a highlighter colour's
    darker sibling, or the stored colour itself for a highlight in an ink."""
    ink = _HIGHLIGHT_BY_VALUE.get(_canonical(value))
    return ink.print_value if ink else value


#: The darkest channel a cover's paper tone may have. A scanned page is grey or
#: cream, never darker than this; a darker "tone" is a black box over the music,
#: which a cover must never become.
PAPER_TONE_FLOOR = 0xC0


def paper_tone(value: object) -> str:
    """A cover's paper colour as ``#RRGGBB``, or '' for anything that is not a
    light paper: not a six-digit hex, or a channel below the floor."""
    text = _canonical(value)
    if len(text) != 7 or not text.startswith("#"):
        return ""
    try:
        channels = [int(text[i:i + 2], 16) for i in (1, 3, 5)]
    except ValueError:
        return ""
    return text if min(channels) >= PAPER_TONE_FLOOR else ""


def is_reserved_ink(value: object) -> bool:
    """Whether this ink may only be written by a manager. An unknown colour is
    not reserved — it is simply not writable, which the serializer says first."""
    ink = _BY_VALUE.get(normalize_ink(value))
    return bool(ink and ink.manager_only)


__all__ = [
    "DEFAULT_INK",
    "HIGHLIGHTER",
    "PALETTE",
    "PAPER_TONE_FLOOR",
    "HighlightInk",
    "Ink",
    "highlight_print_ink",
    "is_highlighter_ink",
    "is_reserved_ink",
    "normalize_ink",
    "paper_tone",
]
