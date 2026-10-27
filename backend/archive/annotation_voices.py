"""
@file annotation_voices.py
@description Which voices a score mark is addressed to, and whether it is
    addressed to one reader.

    A mark names sections, never parts: `S`, `A`, `T`, `B`, the letters a
    sectional rehearsal is called by (``core.voice_labels.SECTION_LETTERS``).
    An empty list is tutti, and so is a list naming all four, which is stored
    empty so that one meaning has one spelling.

    The voices are a display filter and a notification target. They are not
    access control: a mark for the tenors is as readable to a soprano as any
    other mark on the choir's layer, and the layer rules stay the only gate.

    A reader answers to the letters of their seat
    (``core.voice_labels.section_letters_of_seat``): a divisi S1 singer is a
    soprano, and an unseated mezzo answers to the sopranos and the altos alike,
    because a mark missed is worse than a mark read twice. A reader with no
    letters (a player, a conductor, someone with no seat on the piece) is
    addressed by everything. Mirrored on the client by
    ``frontend/src/features/annotations/lib/voices.ts``.
@module archive/annotation_voices
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from core.voice_labels import (
    SECTION_LETTERS,
    canonical_section_letters,
    section_letters_of_seat,
)


class InvalidMarkVoices(ValueError):
    """The value is not a list of section letters."""


def clean_mark_voices(value: Any) -> list[str]:
    """A mark's voices as stored: section letters in SATB order, each once,
    and tutti as an empty list. Anything but a list of known letters raises
    `InvalidMarkVoices`: a mark addressed to a voice nobody sings would never
    reach anyone."""
    if not isinstance(value, (list, tuple)):
        raise InvalidMarkVoices(value)
    if any(not isinstance(code, str) or code not in SECTION_LETTERS for code in value):
        raise InvalidMarkVoices(value)
    letters = canonical_section_letters(value)
    if letters == SECTION_LETTERS:
        return []
    return list(letters)


def mark_letters(voices: Any) -> str:
    """The section letters a stored value names, '' for tutti. A row from
    before voices existed, or one hand-edited into another shape, reads as
    tutti."""
    if not isinstance(voices, (list, tuple)):
        return ''
    letters = canonical_section_letters(code for code in voices if isinstance(code, str))
    return '' if letters == SECTION_LETTERS else letters


def addresses(voices: Any, reader_letters: str) -> bool:
    """Whether a mark with these voices is addressed to a reader who answers
    to `reader_letters`."""
    letters = mark_letters(voices)
    if not letters or not reader_letters:
        return True
    return any(letter in reader_letters for letter in letters)


def widens(before: Any, after: Sequence[str]) -> bool:
    """Whether readdressing a mark reaches a voice it did not reach before.
    Narrowing it tells nobody anything new; widening it is news to the voices
    it now reaches."""
    old = mark_letters(before)
    new = mark_letters(after)
    if not old:
        return False
    if not new:
        return True
    return any(letter not in old for letter in new)


def reader_letters_of_seats(seats: Iterable[tuple[str | None, str | None]]) -> str:
    """The letters a reader answers to across their seats on one piece, given
    as (voice type, seat line) pairs. Two concerts that seat them differently
    on the same music reach both sections."""
    return canonical_section_letters(
        letter
        for voice_type, voice_line in seats
        for letter in section_letters_of_seat(voice_type, voice_line)
    )


__all__ = [
    "InvalidMarkVoices",
    "addresses",
    "clean_mark_voices",
    "mark_letters",
    "reader_letters_of_seats",
    "widens",
]
