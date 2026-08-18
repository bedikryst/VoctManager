# core/voice_labels.py
# ==========================================
# Contextual display names for VoiceLine codes
# ==========================================
"""How a voice line is *named* depends on the arrangement it sits in.

`VoiceLine` stores the divisi index unconditionally — a piece written for one
tenor line still records `T1`, because the code has to stay stable across
pieces. But "Tenor 1" is a promise of a "Tenor 2" somewhere on the page, and a
singer reading it on a piece that has one tenor line is being told about a
division that does not exist. So the index is a property of the *scope*, not of
the code: within a given arrangement, a family with exactly one line is named
plainly ("Tenor"), and only a family that is genuinely divided keeps its number.

Every surface that prints a voice line — the panel, PDFs, e-mails, push —
resolves its label through here, so one singer's part never reads two ways.
The scope is whatever set of codes the reader is looking at: one piece's
divisi, or the union across the pieces of one concert.
"""

import re
from collections.abc import Iterable

from django.utils.translation import gettext_lazy as _

from core.constants import VoiceLine

# Sx / Ax / Tx / Bx — the four choral families — plus Vx, the untyped parts a
# canon or a round divides into. Everything else (SOLO, TUTTI, VP, BACK, ACC,
# PRON) is a standalone role and is never collapsed: those names carry no index.
_DIVISI_CODE = re.compile(r'^([SATBV])([1-9])$')

# Plain family names, used when a family holds a single line in scope. The four
# choral msgids are the ones `roster.VoiceType` already ships — a voice type and
# an undivided voice line are the same word — so only 'Voice' is new here.
_FAMILY_LABELS = {
    'S': _('Soprano'),
    'A': _('Alto'),
    'T': _('Tenor'),
    'B': _('Bass'),
    'V': _('Voice'),
}


def voice_family_of(code: str) -> str | None:
    """'T2' → 'T'. None for a standalone role or an unknown code."""
    match = _DIVISI_CODE.match(code or '')
    return match.group(1) if match else None


def plain_voice_line_label(code: str | None) -> str:
    """The enum's own label, index included ('T1' → 'Tenor 1').

    Tolerant of an unknown or already-rendered value — returns it unchanged, so
    a legacy notification payload never renders blank.
    """
    if not code:
        return ''
    try:
        return str(VoiceLine(code).label)
    except ValueError:
        return str(code)


def collapse_voice_labels(scope: Iterable[str | None]) -> dict[str, str]:
    """Label every code in `scope`, dropping the index of undivided families.

    `scope` is the set of voice lines the reader sees at once — one piece's
    divisi, or the union across a concert's programme. Order and duplicates in
    the input are irrelevant; the result is keyed by code.
    """
    codes = {code for code in scope if code}
    labels = {code: plain_voice_line_label(code) for code in codes}

    families: dict[str, list[str]] = {}
    for code in codes:
        family = voice_family_of(code)
        if family:
            families.setdefault(family, []).append(code)

    for family, members in families.items():
        if len(members) == 1:
            labels[members[0]] = str(_FAMILY_LABELS[family])

    return labels


def voice_line_label(code: str | None, scope: Iterable[str | None]) -> str:
    """Label one code as read inside `scope`. `scope` need not contain `code`.

    An EMPTY scope means "the arrangement is unknown", not "this line is alone":
    a legacy notification payload or a bare detail read has nothing to collapse
    against, and inventing a plain "Soprano" there would claim a piece has no
    divisi on no evidence. Those keep the index. A scope of exactly one line is
    a different statement — that IS an undivided family, and it collapses.
    """
    if not code:
        return ''
    known = {value for value in scope if value}
    if not known:
        return plain_voice_line_label(code)
    return collapse_voice_labels(known | {code}).get(code, plain_voice_line_label(code))
