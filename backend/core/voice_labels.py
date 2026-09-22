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
# canon or a round divides into. Everything else is never collapsed: the
# standalone roles (SOLO, TUTTI, VP, BACK, INSTR, ACC, PRON) and the intermediate
# parts (MS, CT, BAR) carry no index, so their enum label is already the plain
# name a singer reads.
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


# The four sections a sectional rehearsal can call, in the order they are
# written ("SA", "TB"). `Rehearsal.called_sections` stores a subset of these
# letters; everything below resolves a singer to the letters that call them.
SECTION_LETTERS = 'SATB'

# Which sections a VOICE TYPE belongs to — the declared home of the three
# intermediate voices, decided once (2026-09) rather than guessed by prefix:
# a mezzo is called with the sopranos AND the altos, a countertenor with the
# altos, a baritone with the tenors AND the basses. Over-calling is the chosen
# failure mode; a baritone forgotten at a bass sectional is not. Keyed by the
# `roster.VoiceType` code — `core` cannot import the enum — and a conductor or
# a player belongs to no section (instrumentalists keep the
# `calls_instrumentalists` rule).
_SECTIONS_BY_VOICE_TYPE: dict[str, str] = {
    'SOP': 'S',
    'MEZ': 'SA',
    'ALT': 'A',
    'CT': 'A',
    'TEN': 'T',
    'BAR': 'TB',
    'BAS': 'B',
}

# Which sections a VOICE LINE belongs to. A divisi line answers by family
# ('S2' → S); the intermediate lines are declared like the voice types above.
_SECTIONS_BY_STANDALONE_LINE: dict[str, str] = {
    VoiceLine.MEZZO: 'SA',
    VoiceLine.COUNTERTENOR: 'A',
    VoiceLine.BARITONE: 'TB',
}


def canonical_section_letters(letters: Iterable[str]) -> str:
    """'AS' / {'S', 'A', 'A'} → 'SA': deduplicated, in SATB order, unknown
    characters dropped."""
    wanted = set(letters)
    return ''.join(letter for letter in SECTION_LETTERS if letter in wanted)


def section_letters_of_voice_type(voice_type: str | None) -> str:
    """The sections a singer of this voice type is called with — '' for a
    conductor, a player or an unknown code."""
    return _SECTIONS_BY_VOICE_TYPE.get(voice_type or '', '')


def section_letters_of_voice_line(code: str | None) -> str:
    """The sections a voice line is called with — '' for a standalone role
    (SOLO, TUTTI, VP…) or an unknown code, which then falls back to the voice
    type in `section_letters_of_seat`."""
    family = voice_family_of(code or '')
    if family is not None and family in SECTION_LETTERS:
        return family
    return _SECTIONS_BY_STANDALONE_LINE.get(code or '', '')


def section_letters_of_seat(voice_type: str | None, voice_line: str | None) -> str:
    """The sections that call one seat of a line-up.

    The seat's declared line wins over the voice type: a mezzo seated as `A1`
    is an alto for the sectionals of that concert, and a bass seated as `BAR`
    is called by the tenors as well. Without a seat (or on a role line that
    names no section) the voice type decides. Mirrored on the client by
    `sectionLettersOfSeat`, so the count the form previews is the count the
    server calls.
    """
    return section_letters_of_voice_line(voice_line) or section_letters_of_voice_type(voice_type)


#: Section letter → the section, plural, as a conductor says it. Composed in
#: the reader's language at render time, never frozen in the writer's.
_SECTION_NAMES = {
    'S': _('sopranos'),
    'A': _('altos'),
    'T': _('tenors'),
    'B': _('basses'),
}


def section_names_label(letters: Iterable[str]) -> str:
    """'sopranos, altos' from 'SA' or ('S', 'A'). Unknown codes pass through
    unchanged so an old payload never renders a hole."""
    return ', '.join(
        str(_SECTION_NAMES[str(code)]) if str(code) in _SECTION_NAMES else str(code)
        for code in letters
    )


def sectional_call_label(letters: Iterable[str]) -> str:
    """'Sectional: sopranos, altos' — how a sections call is named wherever a
    rehearsal's scope is printed (the day sheet, the invitation e-mail)."""
    return _('Sectional: %(sections)s') % {'sections': section_names_label(letters)}


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
