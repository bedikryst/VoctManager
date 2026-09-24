"""Solo duties of one project's piece, named and legacy, as every reader sees them.

A solo is a duty added to a performer, never their choral part. Two stores hold
one: `ProjectSoloAssignment` (a named position, possibly still open) and the
legacy `ProjectPieceCasting` row on `VoiceLine.SOLO` written before positions had
names. Readers — the songbook, the call sheet, the personal PDF, the dossier —
must show both without mistaking the legacy row for a choir line, and without
inventing a passage for it. This module is the one place that folds the two
into a single ordered list: named positions in the conductor's order, legacy
rows after them.
"""
from __future__ import annotations

import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from core.constants import VoiceLine

if TYPE_CHECKING:
    from roster.models import Participation, ProjectPieceCasting, ProjectSoloAssignment


@dataclass(frozen=True)
class SoloDuty:
    id: uuid.UUID
    is_legacy: bool
    #: The conductor's name for the passage; empty for a legacy row, which has none.
    label: str
    score_reference: str
    #: None only for an open named position.
    participation: Participation | None
    notes: str
    gives_pitch: bool

    @property
    def display_label(self) -> str:
        """What a printed or read list calls this duty. A legacy row says only
        "Solo" — its extent was never recorded, and a guessed name would
        misstate the score."""
        return self.label or str(VoiceLine.SOLO.label)

    @property
    def artist_name(self) -> str | None:
        if self.participation is None:
            return None
        artist = self.participation.artist
        return f'{artist.first_name} {artist.last_name}'


def solo_credit_line(duties: Iterable[SoloDuty]) -> str:
    """A card's performers line read off the filled solos, in the form the
    conductor types it by hand: "Sopran solo: J. Kowalska · Tenor: A. Nowak".
    Open positions have nobody to credit and are left out."""
    credits = []
    for duty in duties:
        if duty.participation is None:
            continue
        artist = duty.participation.artist
        initial = f'{artist.first_name.strip()[:1]}. ' if artist.first_name.strip() else ''
        credits.append(f'{duty.display_label}: {initial}{artist.last_name}')
    return ' · '.join(credits)


def is_legacy_solo(casting: ProjectPieceCasting) -> bool:
    return casting.voice_line == VoiceLine.SOLO


def choral_castings(castings: Iterable[ProjectPieceCasting]) -> list[ProjectPieceCasting]:
    """The castings that are choir seats — every row except a legacy solo."""
    return [casting for casting in castings if not is_legacy_solo(casting)]


def solo_duties(
    solos: Iterable[ProjectSoloAssignment],
    castings: Iterable[ProjectPieceCasting],
) -> list[SoloDuty]:
    """Named positions by position, then the legacy SOLO rows among `castings`.

    Both inputs must already be sliced to one project and one piece. A named
    position whose performer's participation was soft-deleted reads as open,
    the same way a removed member's casting stops counting as a seat.
    """
    named = sorted(solos, key=lambda solo: (solo.position, str(solo.id)))
    duties = [
        SoloDuty(
            id=solo.id,
            is_legacy=False,
            label=solo.label,
            score_reference=solo.score_reference,
            participation=(
                solo.participation
                if solo.participation is not None and not solo.participation.is_deleted
                else None
            ),
            notes=solo.notes,
            gives_pitch=solo.gives_pitch,
        )
        for solo in named
    ]
    duties += [
        SoloDuty(
            id=casting.id,
            is_legacy=True,
            label='',
            score_reference='',
            participation=casting.participation,
            notes=casting.notes,
            gives_pitch=casting.gives_pitch,
        )
        for casting in castings
        if is_legacy_solo(casting)
    ]
    return duties
