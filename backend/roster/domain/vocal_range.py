"""The shape of a vocal range: a tessitura and two optional extremes, as MIDI.

Two records share it. The singer's own proposal (`Artist.proposed_*`, written by
`VocalRangeService.submit_proposal`) and the conductor's assessment
(`Artist.assessed_*`, written through the manager's create and PATCH) hold the
same four notes, so "Przyjmij propozycję" copies one onto the other slot for
slot and every reader draws both alike. This module is the one statement of
the rule both writes check; the client mirrors it in `rangeProblem`
(`rangeDraft.ts`).

The one difference between the two: a proposal always has a tessitura, while an
assessment may be empty, meaning the conductor has not assessed this singer yet.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# The full 88-key piano, A0-C8. A sanity bound against garbage, not a musical
# claim: the singer's keyboard only offers G1-C7, so a real submission never
# comes near either end.
VOCAL_RANGE_MIDI_MIN = 21
VOCAL_RANGE_MIDI_MAX = 108

RangeSlot = Literal["tessitura_low", "tessitura_high", "extreme_low", "extreme_high"]


@dataclass(frozen=True)
class RangeShapeError:
    #: The note that breaks the rule, so a form can light that one slot.
    slot: RangeSlot
    message: str


def range_shape_error(
    tessitura_low: int | None,
    tessitura_high: int | None,
    extreme_low: int | None,
    extreme_high: int | None,
    *,
    required: bool,
) -> RangeShapeError | None:
    """The first way these four notes fail to be a range, or None.

    With `required=False`, four empty notes are a valid answer. Once any note is
    set, the tessitura pair is required: an extreme alone says where the voice
    stops without saying where it lives. An extreme may sit flush with its
    tessitura bound, never inside it. The 21-108 bounds belong to each field's
    own validation, not to this rule.
    """
    if tessitura_low is None or tessitura_high is None:
        nothing_set = tessitura_low is None and tessitura_high is None and extreme_low is None and extreme_high is None
        if nothing_set and not required:
            return None
        missing: RangeSlot = "tessitura_low" if tessitura_low is None else "tessitura_high"
        return RangeShapeError(missing, "The tessitura needs both its notes.")
    if tessitura_low >= tessitura_high:
        return RangeShapeError("tessitura_low", "The tessitura's low note must be below its high note.")
    if extreme_low is not None and extreme_low > tessitura_low:
        return RangeShapeError("extreme_low", "The low extreme must not be above the tessitura.")
    if extreme_high is not None and extreme_high < tessitura_high:
        return RangeShapeError("extreme_high", "The high extreme must not be below the tessitura.")
    return None
