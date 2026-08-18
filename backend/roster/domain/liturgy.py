"""
@file liturgy.py
@description The order of the Mass as a closed, typed vocabulary, and the rules
    that turn one programme item's slot into the words a reader sees. A Mass item
    answers "when in the liturgy does this happen", and that answer has to read
    the same in the singer's app, on the printed day card and on the score-book
    card — in each reader's own language. A prefix somebody types by hand cannot
    do that, which is why this table exists at all.
    Repeats are numbered here and nowhere else: "Na Komunię 1 / 2" is a property
    of one programme, not of one row, so no surface may derive it on its own.
@architecture Enterprise SaaS 2026
@module roster/domain/liturgy
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from django.utils.functional import Promise
from django.utils.translation import pgettext_lazy

# Every label here carries a gettext context, spelled out at each call so the
# msgids stay greppable and extractable. The reason is concrete: the bare msgid
# "Entrance" is already the call sheet's word for the DOOR the ensemble comes in
# by, and a slot sharing it would print "Wejście" where the liturgy means
# "Na wejście".


class LiturgicalPart(StrEnum):
    """The divisions of the rite a programme is grouped under. Drives the derived
    section heading, which is the only place a part is ever named."""

    PRELUDE = "prelude"
    INTRODUCTORY = "introductory"
    WORD = "word"
    EUCHARIST = "eucharist"
    CONCLUDING = "concluding"


class SlotKind(StrEnum):
    """What kind of thing the slot is — and therefore whether its name has to be
    printed before the piece's title.

    ORDINARY: the piece *is* that part of the Mass (a Kyrie is titled "Kyrie"), so
    a prefix restates the title. PROPER: the text belongs to the day and the title
    normally says so. FUNCTION: a freely chosen piece doing a job at a known
    moment — the one case where a reader cannot know when it happens unless told.
    """

    ORDINARY = "ordinary"
    PROPER = "proper"
    FUNCTION = "function"


@dataclass(frozen=True)
class LiturgicalSlot:
    code: str
    rank: int
    part: LiturgicalPart
    kind: SlotKind
    label: Promise


# Ranks step by ten so a slot can be inserted between two existing ones without
# rewriting the table or touching a single stored row.
SLOTS: tuple[LiturgicalSlot, ...] = (
    LiturgicalSlot("prelude", 10, LiturgicalPart.PRELUDE, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Before Mass")),
    LiturgicalSlot("entrance", 20, LiturgicalPart.INTRODUCTORY, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Entrance")),
    LiturgicalSlot("kyrie", 30, LiturgicalPart.INTRODUCTORY, SlotKind.ORDINARY,
                   pgettext_lazy("liturgical slot", "Kyrie")),
    LiturgicalSlot("gloria", 40, LiturgicalPart.INTRODUCTORY, SlotKind.ORDINARY,
                   pgettext_lazy("liturgical slot", "Gloria")),
    LiturgicalSlot("psalm", 50, LiturgicalPart.WORD, SlotKind.PROPER,
                   pgettext_lazy("liturgical slot", "Responsorial psalm")),
    LiturgicalSlot("acclamation", 60, LiturgicalPart.WORD, SlotKind.PROPER,
                   pgettext_lazy("liturgical slot", "Gospel acclamation")),
    LiturgicalSlot("vows", 70, LiturgicalPart.WORD, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Marriage vows")),
    LiturgicalSlot("rings", 80, LiturgicalPart.WORD, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Blessing of the rings")),
    LiturgicalSlot("intercessions", 90, LiturgicalPart.WORD, SlotKind.PROPER,
                   pgettext_lazy("liturgical slot", "Prayer of the faithful")),
    LiturgicalSlot("offertory", 100, LiturgicalPart.EUCHARIST, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Offertory")),
    LiturgicalSlot("sanctus", 110, LiturgicalPart.EUCHARIST, SlotKind.ORDINARY,
                   pgettext_lazy("liturgical slot", "Sanctus")),
    LiturgicalSlot("benedictus", 120, LiturgicalPart.EUCHARIST, SlotKind.ORDINARY,
                   pgettext_lazy("liturgical slot", "Benedictus")),
    LiturgicalSlot("agnus_dei", 130, LiturgicalPart.EUCHARIST, SlotKind.ORDINARY,
                   pgettext_lazy("liturgical slot", "Agnus Dei")),
    LiturgicalSlot("communion", 140, LiturgicalPart.EUCHARIST, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Communion")),
    LiturgicalSlot("thanksgiving", 150, LiturgicalPart.CONCLUDING, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Thanksgiving")),
    LiturgicalSlot("recessional", 160, LiturgicalPart.CONCLUDING, SlotKind.FUNCTION,
                   pgettext_lazy("liturgical slot", "Recessional")),
)

SLOTS_BY_CODE: dict[str, LiturgicalSlot] = {slot.code: slot for slot in SLOTS}

PART_LABELS: dict[LiturgicalPart, Promise] = {
    LiturgicalPart.PRELUDE: pgettext_lazy("liturgy part", "Before Mass"),
    LiturgicalPart.INTRODUCTORY: pgettext_lazy("liturgy part", "Introductory rites"),
    LiturgicalPart.WORD: pgettext_lazy("liturgy part", "Liturgy of the Word"),
    LiturgicalPart.EUCHARIST: pgettext_lazy("liturgy part", "Liturgy of the Eucharist"),
    LiturgicalPart.CONCLUDING: pgettext_lazy("liturgy part", "Concluding rites"),
}

# Model-field choices. Blank stays a valid value: a concert item has no slot, and
# a Mass built before its running order is known has none yet either.
SLOT_CHOICES: tuple[tuple[str, Promise], ...] = tuple(
    (slot.code, slot.label) for slot in SLOTS
)

# What a manager is offered first for each kind of event. The full vocabulary
# always stays available — a Mass that skips the Gloria in Lent is not an error,
# and neither is a wedding that keeps every ordinary part.
_WEDDING_ONLY: frozenset[str] = frozenset({"vows", "rings"})

SLOT_TEMPLATES: dict[str, tuple[str, ...]] = {
    "MASS": tuple(slot.code for slot in SLOTS if slot.code not in _WEDDING_ONLY),
    "WEDDING": tuple(slot.code for slot in SLOTS),
}


class ProgramItemFacts(Protocol):
    """The four things a programme item has to expose to be presented. Read-only
    by design: this module never writes, and the protocol keeps the domain free of
    a model import (the rule stated in ``roster/domain/__init__.py``)."""

    @property
    def order(self) -> int: ...

    @property
    def liturgical_slot(self) -> str: ...

    @property
    def section_label(self) -> str: ...

    @property
    def role_prefix(self) -> str: ...


@dataclass(frozen=True)
class ProgramItemPresentation:
    """One item's liturgical identity, resolved against the whole programme.

    ``slot_label`` is what every surface shows (numbered when the slot repeats).
    ``role_prefix`` is narrower — it is what prints *before the title* on the
    score-book card, and it is empty for an ordinary or proper part, where the
    title already carries the name. A stored override always wins over both.
    """

    slot: str
    slot_label: str
    section: str
    role_prefix: str
    rank: int | None


def build_program_presentation(
    items: Sequence[ProgramItemFacts],
) -> tuple[ProgramItemPresentation, ...]:
    """Resolve every item's liturgical labels, in the order the programme runs.

    Returns one presentation per input item, positionally. Repeats are numbered in
    running order, so the second *Na Komunię* is "Na Komunię 2" whether or not
    anything sits between them — and stays correct when the first one is deleted.
    """
    counts = Counter(
        item.liturgical_slot for item in items if item.liturgical_slot in SLOTS_BY_CODE
    )
    seen: Counter[str] = Counter()
    presentations: list[ProgramItemPresentation] = []

    for item in items:
        slot = SLOTS_BY_CODE.get(item.liturgical_slot or "")
        override_section = (item.section_label or "").strip()
        override_role = (item.role_prefix or "").strip()

        if slot is None:
            presentations.append(
                ProgramItemPresentation(
                    slot="",
                    slot_label="",
                    section=override_section,
                    role_prefix=override_role,
                    rank=None,
                )
            )
            continue

        label = str(slot.label)
        if counts[slot.code] > 1:
            seen[slot.code] += 1
            label = f"{label} {seen[slot.code]}"

        presentations.append(
            ProgramItemPresentation(
                slot=slot.code,
                slot_label=label,
                section=override_section or str(PART_LABELS[slot.part]),
                role_prefix=override_role or (
                    f"{label}:" if slot.kind is SlotKind.FUNCTION else ""
                ),
                rank=slot.rank,
            )
        )

    return tuple(presentations)


def liturgy_order_problems(items: Sequence[ProgramItemFacts]) -> tuple[int, ...]:
    """Indices of items whose slot sits earlier in the rite than one already
    passed — a Gloria after the Sanctus.

    Reported, never corrected: the running order is the producer's, and a
    programme may contradict the canon deliberately (a piece moved because the
    celebrant asked for it). Items without a slot are transparent here; they
    neither break a run nor belong to one.
    """
    problems: list[int] = []
    highest: int | None = None
    for index, item in enumerate(items):
        slot = SLOTS_BY_CODE.get(item.liturgical_slot or "")
        if slot is None:
            continue
        if highest is not None and slot.rank < highest:
            problems.append(index)
        else:
            highest = slot.rank
    return tuple(problems)


def canonical_sort_key(item: ProgramItemFacts) -> tuple[int, int]:
    """Sort key for the "order by liturgy" action. Items without a slot keep their
    relative position at the end rather than being scattered through the rite:
    they are the ones nobody has classified yet, and burying them mid-programme is
    how they stay unclassified."""
    slot = SLOTS_BY_CODE.get(item.liturgical_slot or "")
    return (slot.rank if slot is not None else 10_000, item.order)


def vocabulary_payload() -> dict[str, object]:
    """The whole vocabulary in the reader's language, for the client's slot
    picker. Served rather than duplicated in the frontend for the same reason the
    day-of moments are: two copies of one name is a singer reading two names for
    one moment."""
    return {
        "slots": [
            {
                "value": slot.code,
                "label": str(slot.label),
                "part": slot.part.value,
                "part_label": str(PART_LABELS[slot.part]),
                "kind": slot.kind.value,
            }
            for slot in SLOTS
        ],
        "templates": {kind: list(codes) for kind, codes in SLOT_TEMPLATES.items()},
    }


__all__ = [
    "PART_LABELS",
    "SLOTS",
    "SLOTS_BY_CODE",
    "SLOT_CHOICES",
    "SLOT_TEMPLATES",
    "LiturgicalPart",
    "LiturgicalSlot",
    "ProgramItemFacts",
    "ProgramItemPresentation",
    "SlotKind",
    "build_program_presentation",
    "canonical_sort_key",
    "liturgy_order_problems",
    "vocabulary_payload",
]
