"""One reading order for the cast, shared by every surface that lists it.

A choir is read in the order its conductor arranged it, and each surface used to
invent that order for itself: the casting tab sorted one way, the divisi board
not at all, the songbook printed whatever the database happened to return. This
module holds the single key they all sort by, so a singer moved in the line-up
moves in the programme, in the songbook and on the printed sheet at once.

The key, outermost first:

1. voice type — sopranos, then altos, then tenors, then basses;
2. the conductor's arrangement of that section (``Participation.section_rank``);
3. whoever leads it, which decides something only in a section nobody has
   arranged: a rank always wins, or dragging a singer past the marked leader
   would visibly do nothing;
4. their seat in the line-up (S1 before S2), under the same proviso;
5. surname, then first name — so an untouched project still reads as the
   alphabetical list it always did.

Ranks are only ever COMPARED, never counted: they are written dense per section
because a whole section goes up at once, but a collision inherited from an
earlier project simply falls through to the tie-breakers under it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from core.constants import VoiceLine
from roster.models import VoiceType

if TYPE_CHECKING:
    from roster.models import Participation, ProjectPieceCasting

# Keyed by VoiceType (a str-valued TextChoices), so the keys double as plain
# strings for ordering lookups by the serialized voice-type value.
VOICE_TYPE_ORDER: dict[str, int] = {
    VoiceType.SOPRANO: 0,
    VoiceType.MEZZO: 1,
    VoiceType.ALTO: 2,
    VoiceType.COUNTERTENOR: 3,
    VoiceType.TENOR: 4,
    VoiceType.BARITONE: 5,
    VoiceType.BASS: 6,
    VoiceType.CONDUCTOR: 7,
}

VOICE_LINE_ORDER: dict[str, int] = {
    value: index for index, value in enumerate(VoiceLine.values)
}

# Anything the maps do not know sorts after everything they do — never before,
# which is where a -1 miss would file it.
_UNKNOWN_VOICE_TYPE = len(VOICE_TYPE_ORDER)
_UNKNOWN_VOICE_LINE = len(VOICE_LINE_ORDER)

#: What one singer's place in the cast comes down to. Spelled out because the
#: tuple is heterogeneous and every position is a decision documented above.
CastSortKey = tuple[int, bool, int, bool, int, str, str]

#: One seat on a piece's board: which line, then who on it.
CastingSortKey = tuple[int, CastSortKey]


def participation_sort_key(participation: Participation) -> CastSortKey:
    """Where this singer stands in the cast — see the module docstring."""
    artist = participation.artist
    rank = participation.section_rank
    return (
        VOICE_TYPE_ORDER.get(artist.voice_type, _UNKNOWN_VOICE_TYPE),
        # Two positions rather than a sentinel: an unarranged singer goes after
        # every arranged one, whatever numbers the arrangement happens to use.
        rank is None,
        rank if rank is not None else 0,
        not participation.is_section_leader,
        VOICE_LINE_ORDER.get(participation.default_voice_line, _UNKNOWN_VOICE_LINE),
        artist.last_name,
        artist.first_name,
    )


def casting_sort_key(casting: ProjectPieceCasting) -> CastingSortKey:
    """Where this seat prints on a piece's board.

    Voice type still leads inside a single line, and has to: a rank is a
    position within one section, so the mezzo who takes S2 and the soprano
    beside her can both be that section's third singer. Grouping by voice type
    first is what keeps two incomparable ranks from deciding anything.
    """
    return (
        VOICE_LINE_ORDER.get(casting.voice_line, _UNKNOWN_VOICE_LINE),
        participation_sort_key(casting.participation),
    )
