"""
@file annotation_palette.py
@description The five inks a marking may be written in, and which of them are the
    conductor's alone.

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

    The editor's copy of the palette lives in
    ``frontend/src/features/annotations/lib/palette.ts``. A parity test asserts
    the two lists match, because a swatch the editor offers and the server
    refuses is a mark a chorister cannot make and is never told why.
@architecture Enterprise SaaS 2026
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


PALETTE: tuple[Ink, ...] = (
    Ink("#DC2626", "crimson", manager_only=True),  # the conductor's cue
    Ink("#2563EB", "cobalt"),
    Ink("#15803D", "verdigris"),
    Ink("#B45309", "gilt"),
    Ink("#1F2933", "graphite"),                    # a reader's pencil
)

#: What a mark is written in when the writer names no colour. Deliberately the
#: unreserved end of the palette: an unnamed ink must never be an authority one.
DEFAULT_INK: str = "#1F2933"

_BY_VALUE: dict[str, Ink] = {ink.value: ink for ink in PALETTE}


def normalize_ink(value: object) -> str:
    """A stored colour in the palette's own casing, or '' for anything the
    palette does not contain. Case-insensitive: the wire format has never been
    guaranteed, and `#dc2626` is the same ink."""
    text = str(value or "").strip().upper()
    return text if text in _BY_VALUE else ""


def is_reserved_ink(value: object) -> bool:
    """Whether this ink may only be written by a manager. An unknown colour is
    not reserved — it is simply not writable, which the serializer says first."""
    ink = _BY_VALUE.get(normalize_ink(value))
    return bool(ink and ink.manager_only)


__all__ = ["DEFAULT_INK", "PALETTE", "Ink", "is_reserved_ink", "normalize_ink"]
