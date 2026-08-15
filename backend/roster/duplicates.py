"""
@file duplicates.py
@description Finds roster rows that are probably one human.

`Artist` uniqueness is on the e-mail column alone, and only among non-deleted
rows (`unique_active_artist_email`), so it catches exactly one shape of
duplicate: the same address, character for character. Everything else gets
through — an address that differs only in case, an address typed twice with a
typo, a second row created before anyone thought to search for the first. The
call sheet found one by printing `Pia Antonia Franciska Vućemilović` twice in
one voice section and counting it as two singers.

This reports **candidates, never verdicts**. Two people can genuinely share a
name — which is why the printed sheet collapses a repeated name to "(2 entries)"
rather than deleting one, and why the merge is a decision a manager takes with
both records in front of them.
@architecture Enterprise SaaS 2026
@module roster/duplicates
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum

from .models import Artist

# NFD leaves a stroked letter alone — `ł` is one codepoint, not `l` plus a
# combining mark — so it is folded by hand. Without this "Michał" and "Michal"
# are two different people to every comparison in the system.
_STROKED = str.maketrans({'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ø': 'o', 'Ø': 'O'})
_NON_ALNUM = re.compile(r'[^a-z0-9]+')
_NON_DIGIT = re.compile(r'\D+')
# Below this a "number" is a fragment somebody started typing, and every short
# fragment would collide with every other.
_MIN_PHONE_DIGITS = 7


class DuplicateSignal(StrEnum):
    """What made two rows look like one person, strongest first.

    The order is the confidence order and the UI reads it that way: an address
    or a number is a near-certainty, a shared name is a question.
    """

    EMAIL = "email"
    PHONE = "phone"
    NAME = "name"


@dataclass(frozen=True)
class DuplicateGroup:
    """One set of rows that share a signal. ``key`` is the normalized value they
    collided on, kept so the reason can be shown rather than asserted."""

    signal: DuplicateSignal
    key: str
    artist_ids: tuple[str, ...]


def fold(value: str | None) -> str:
    """Case-folded, diacritic-free, punctuation-free comparison form."""
    if not value:
        return ''
    decomposed = unicodedata.normalize('NFD', value.translate(_STROKED))
    stripped = ''.join(ch for ch in decomposed if not unicodedata.combining(ch))
    return _NON_ALNUM.sub(' ', stripped.casefold()).strip()


def normalize_name(first_name: str, last_name: str) -> str:
    """A full name in comparison form, ordered so that a row entered surname-first
    still collides with the same person entered given-name-first."""
    parts = sorted(f'{fold(first_name)} {fold(last_name)}'.split())
    return ' '.join(parts)


def normalize_phone(value: str | None) -> str:
    """Digits only, and the national trunk prefix is *not* guessed away: this
    compares what was typed, so `+48 600…` and `600…` stay apart unless the
    longer one ends with the shorter, which the caller decides."""
    return _NON_DIGIT.sub('', value or '')


def _phone_key(value: str | None) -> str:
    """The last nine digits — enough to make `+48 600 100 200` and
    `600 100 200` the same number without inventing a country for either."""
    digits = normalize_phone(value)
    return digits[-9:] if len(digits) >= _MIN_PHONE_DIGITS else ''


def find_duplicate_groups(artists: Iterable[Artist] | None = None) -> list[DuplicateGroup]:
    """Candidate duplicates across the active roster, strongest signal first.

    Archived rows are excluded: archiving is how a duplicate that has already
    been dealt with leaves the roster, and re-reporting it forever would make
    this list impossible to keep at zero. The same *membership* is reported once,
    under its strongest signal — two rows sharing an address share a name too,
    and listing that pair twice would double the work rather than describe it. A
    name group that sweeps in a third row is a different set and does appear,
    because the third row is a question the address group never asked.
    """
    roster: Sequence[Artist] = (
        list(artists)
        if artists is not None
        else list(Artist.objects.all().order_by('last_name', 'first_name'))
    )

    buckets: dict[DuplicateSignal, dict[str, list[Artist]]] = {
        signal: defaultdict(list) for signal in DuplicateSignal
    }
    for artist in roster:
        if email := fold(artist.email):
            buckets[DuplicateSignal.EMAIL][email].append(artist)
        if phone := _phone_key(artist.phone_number):
            buckets[DuplicateSignal.PHONE][phone].append(artist)
        if name := normalize_name(artist.first_name, artist.last_name):
            buckets[DuplicateSignal.NAME][name].append(artist)

    groups: list[DuplicateGroup] = []
    reported: set[frozenset[str]] = set()
    for signal in DuplicateSignal:
        for key, members in buckets[signal].items():
            if len(members) < 2:
                continue
            identity = frozenset(str(member.pk) for member in members)
            if identity in reported:
                continue
            reported.add(identity)
            groups.append(
                DuplicateGroup(
                    signal=signal,
                    key=key,
                    artist_ids=tuple(str(member.pk) for member in members),
                )
            )
    return groups
