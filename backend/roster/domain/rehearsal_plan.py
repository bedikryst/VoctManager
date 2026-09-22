"""
@file rehearsal_plan.py
@description The rehearsal plan as a rule: which rows of an ordered plan call a
    given seat, when each row starts (anchors and minutes), how the rows fall
    into time blocks, the window one reader is actually needed for, and
    whether a row was worked on. Pure — no ORM,
    and the clock is always an argument — so the serializer, the reminder and
    (through the shared golden cases) the client's exclusion chips all answer
    from one function and cannot disagree about who "bez B2" removes. A seat
    is called by a row through its casting on the row's piece when it has
    one, otherwise through the section letters it answers a sectional by; a
    player is called by the rehearsal's flag and the row's; a break calls
    nobody. The window is derived per reader and never written back: the
    rehearsal keeps one start and one end, and a row outside them is the
    conductor's warning to himself, not an error.
@architecture Enterprise SaaS 2026
@module roster/domain/rehearsal_plan
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Protocol

from core.voice_labels import section_letters_of_voice_line

# How long after its start an evening nobody timed counts as over. The twin of
# the panel's `PAST_GRACE_MS`, which moves a card from "upcoming" to "past" on
# the same four hours — the plan must not read as done on a card still listed
# as upcoming.
UNTIMED_EVENING_LENGTH = timedelta(hours=4)

# The lines a row offers for exclusion when its piece declares none — and the
# lines a row without a piece offers: the four-part reading an uncast programme
# has always had. The intermediate lines (MS, CT, BAR) are declared by an
# arrangement, never implied, so they appear only when a piece names them.
CANONICAL_LINES: tuple[str, ...] = (
    'S1', 'S2', 'S3',
    'A1', 'A2', 'A3',
    'T1', 'T2', 'T3',
    'B1', 'B2', 'B3',
)


@dataclass(frozen=True)
class PlanRow:
    """One row of the plan as the rule reads it.

    ``piece`` is an opaque key (the piece id as text, or ``None`` for a free
    row) matched against the seat's ``cast_lines``. ``starts_at`` is the
    conductor's anchor and ``minutes`` his estimate — the row's clock is
    derived from both by :func:`effective_clocks`. ``lines`` are the lines the
    exclusions were chosen from — see :func:`row_lines`. A break still opens
    a block when it has a clock; it simply calls nobody. Whether a row is
    reserve is not read here at all: a reserve row counts toward the window,
    which promises the worst case.
    """

    piece: str | None
    starts_at: time | None
    lines: frozenset[str]
    excluded_lines: frozenset[str]
    excludes_instrumentalists: bool
    is_break: bool = False
    minutes: int | None = None


@dataclass(frozen=True)
class PlanSeat:
    """One reader's seat as the rule reads it: the SATB letters a sectional
    calls it by (``Participation.section_letters``), whether it is a player's,
    and the voice line it holds on each piece of the board it is cast on."""

    section_letters: str
    is_instrumentalist: bool
    cast_lines: Mapping[str, str]


@dataclass(frozen=True)
class EffectiveClock:
    """When one row starts, as far as the plan knows. ``clock`` is ``None``
    when nothing fixes it — the row flows under the last clock above it.
    ``derived`` is true when the clock follows from minutes (or is the
    rehearsal's own start) rather than being an anchor the conductor typed."""

    clock: time | None
    derived: bool


@dataclass(frozen=True)
class PlanBlock:
    """Consecutive rows sharing one effective clock. The first row always has
    one — its anchor, else the rehearsal's own start — so every block does."""

    starts_at: time
    rows: tuple[int, ...]


@dataclass(frozen=True)
class PlanWindow:
    """What the plan says about one reader's evening. ``calls_me`` false means
    no row calls the seat — the CALL is unchanged (attendance, reminder and
    calendar still count it); the page says the plan does not need this voice.
    ``end`` is ``None`` for an open end: the reader is needed until the
    rehearsal ends, and nobody has timed it."""

    calls_me: bool
    start: time | None
    end: time | None


def row_lines(declared: Iterable[str]) -> frozenset[str]:
    """The lines a row's exclusions are chosen from: the piece's declared
    divisi, or the canonical four-part set when it declares nothing (and for a
    row without a piece)."""
    lines = frozenset(code for code in declared if code)
    return lines or frozenset(CANONICAL_LINES)


def item_calls_seat(row: PlanRow, seat: PlanSeat, *, calls_instrumentalists: bool) -> bool:
    """Whether ``row`` needs ``seat`` in the room.

    A break needs nobody, players included — a labelled "Przerwa" that called
    everyone would keep the men until the ladies-only piece after it. A player
    answers to the rehearsal's flag and the row's, never to a line — a player
    is not a voice line. A singer cast on the row's piece is called unless
    that very line is excluded. A singer without a casting is called
    conservatively: as long as any line that answers to one of the seat's
    section letters is still offered by the row. So "bez B2" only bites a bass
    once the basses are cast — the known cost of resolving through casting.
    """
    if row.is_break:
        return False
    if seat.is_instrumentalist:
        return calls_instrumentalists and not row.excludes_instrumentalists
    cast_line = seat.cast_lines.get(row.piece) if row.piece is not None else None
    if cast_line:
        return cast_line not in row.excluded_lines
    letters = set(seat.section_letters)
    if not letters:
        return False
    return any(
        letters.intersection(section_letters_of_voice_line(line))
        for line in row.lines - row.excluded_lines
    )


def _plus_minutes(clock: time, minutes: int) -> time:
    return (datetime.combine(date(2000, 1, 1), clock) + timedelta(minutes=minutes)).time()


class TimedRow(Protocol):
    """Whatever carries an anchor and minutes — a rule row, or a stored row
    read without the lines the call rule would need."""

    @property
    def starts_at(self) -> time | None: ...

    @property
    def minutes(self) -> int | None: ...


def effective_clocks(rows: Sequence[TimedRow], start: time) -> list[EffectiveClock]:
    """Every row's clock, in plan order.

    An anchor (``starts_at``) wins — it is the promise, even when the minutes
    above it add up to later. Otherwise a row starts at the previous row's
    clock plus the previous row's minutes, when both are known; an unanchored
    FIRST row starts at the rehearsal's start. Anything else flows
    under the last clock (``clock=None``), and so does every row after it
    until the next anchor. With no minutes anywhere, the clocks are the
    anchors — the rule the plan had before minutes existed.
    """
    clocks: list[EffectiveClock] = []
    following: time | None = start
    for row in rows:
        if row.starts_at is not None:
            entry = EffectiveClock(clock=row.starts_at, derived=False)
        elif following is not None:
            entry = EffectiveClock(clock=following, derived=True)
        else:
            entry = EffectiveClock(clock=None, derived=False)
        clocks.append(entry)
        following = (
            _plus_minutes(entry.clock, row.minutes)
            if entry.clock is not None and row.minutes
            else None
        )
    return clocks


def plan_blocks(rows: Sequence[PlanRow], start: time) -> list[PlanBlock]:
    """Group the rows into blocks by effective clock, in the order they were
    laid out: a row that flows under joins the block above it. Never sorted —
    ordering carries the warning, so a clock earlier than its predecessor is
    still the next block."""
    blocks: list[PlanBlock] = []
    carried = start
    current: list[int] = []
    for index, entry in enumerate(effective_clocks(rows, start)):
        if entry.clock is not None and entry.clock != carried:
            if current:
                blocks.append(PlanBlock(starts_at=carried, rows=tuple(current)))
                current = []
            carried = entry.clock
        current.append(index)
    if current:
        blocks.append(PlanBlock(starts_at=carried, rows=tuple(current)))
    return blocks


def plan_window_for_seat(
    rows: Sequence[PlanRow],
    seat: PlanSeat,
    *,
    start: time,
    end: time | None,
    calls_instrumentalists: bool,
) -> PlanWindow | None:
    """The part of the evening ``seat`` is needed for, in the rehearsal's own
    wall clock.

    Read off EVERY effective clock, derived ones included — never off the
    subset a chorister is shown. Opens with the reader's first block and
    closes with the first block AFTER
    their last one — a gap in the middle is not an end, nobody leaves and
    comes back — else with the rehearsal's end (``None`` when it was never
    timed: "od 19:00"). ``None`` when there is nothing to say: an empty plan,
    or a window equal to the whole rehearsal.
    """
    blocks = plan_blocks(rows, start)
    if not blocks:
        return None
    called = [
        item_calls_seat(row, seat, calls_instrumentalists=calls_instrumentalists)
        for row in rows
    ]
    mine = [
        index for index, block in enumerate(blocks)
        if any(called[row_index] for row_index in block.rows)
    ]
    if not mine:
        return PlanWindow(calls_me=False, start=None, end=None)

    window_start = blocks[mine[0]].starts_at
    following = mine[-1] + 1
    window_end = blocks[following].starts_at if following < len(blocks) else end
    if window_start == start and window_end == end:
        return None
    return PlanWindow(calls_me=True, start=window_start, end=window_end)


def window_payload(window: PlanWindow | None) -> dict[str, object] | None:
    """The window as every wire carries it: wall-clock ``"HH:MM"`` strings, or
    ``None`` when the plan has nothing to say. The rehearsal read and the
    reminder's metadata share this shape so a card, a page and a push cannot
    word one evening three ways."""
    if window is None:
        return None
    return {
        'calls_me': window.calls_me,
        'start': window.start.strftime('%H:%M') if window.start else None,
        'end': window.end.strftime('%H:%M') if window.end else None,
    }


def evening_is_over(start: datetime, end: datetime | None, now: datetime) -> bool:
    """Whether an evening is behind us: past its end, or — when nobody timed
    it — past :data:`UNTIMED_EVENING_LENGTH` after its start."""
    return now >= (end if end is not None else start + UNTIMED_EVENING_LENGTH)


def row_done(
    *, ticked: bool, skipped: bool, is_reserve: bool, is_break: bool, over: bool,
) -> bool | None:
    """Whether a row was worked on, as every reader is told it.

    The plan is the default. A debrief is the step most often missed, and an
    evening with no ticks must not read as "nothing happened": once it is
    over, a main row reads done and a reserve row — "if time allows" — does
    not. The debrief's explicit verdict (``ticked`` / ``skipped``) wins either
    way. Before the end with no verdict, nothing is known yet (``None``). A
    break is never a verdict: it is not a piece of work.
    """
    if is_break:
        return None
    if ticked:
        return True
    if skipped:
        return False
    if not over:
        return None
    return not is_reserve


__all__ = [
    "CANONICAL_LINES",
    "UNTIMED_EVENING_LENGTH",
    "EffectiveClock",
    "PlanBlock",
    "PlanRow",
    "PlanSeat",
    "PlanWindow",
    "TimedRow",
    "effective_clocks",
    "evening_is_over",
    "item_calls_seat",
    "plan_blocks",
    "plan_window_for_seat",
    "row_done",
    "row_lines",
    "window_payload",
]
