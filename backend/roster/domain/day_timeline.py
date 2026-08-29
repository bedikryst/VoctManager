"""
@file day_timeline.py
@description The concert day as one axis: the two anchors a producer plans
    around — the call time and the downbeat — merged with the editable run-sheet
    points between them, plus the relation between the anchors themselves.
    Kept in one module because they are one fact: a call time is only meaningful
    *relative to* the concert, and the arithmetic has failure modes a bare
    subtraction states as truth (a call after the downbeat, or one entered on the
    wrong date, which prints as a plausible hour while sitting weeks away).
    Every document and read-model that shows an arrival time or a day plan reads
    this, so none of them can invent its own threshold or its own ordering.
@architecture Enterprise SaaS 2026
@module roster/domain/day_timeline
"""

from __future__ import annotations

import zoneinfo
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, time
from enum import StrEnum
from typing import Any

from django.utils import timezone

# Beyond this, the gap is not a call window but a date entered on the wrong day,
# and must be reported as such instead of stated as an arrival window.
#
# The ceiling is a full day because the legitimate long call is real: an evening
# call for a late-morning concert on tour runs 14-16 h, and the bus for an
# out-of-town date leaves in the morning for an evening downbeat. A tighter
# ceiling flags those as faults — and would contradict ``crosses_day`` below,
# which exists precisely to bless them. One day is the widest gap that can still
# belong to this concert; the errors this guards against (a call entered a day,
# a month or, as observed, twenty days early) all clear it comfortably.
MAX_PLAUSIBLE_BUFFER_MINUTES = 24 * 60

MINUTES_PER_DAY = 24 * 60
# Run-sheet titles arrive under whichever key the editor used at the time; the
# field has never been validated, so every shape it has shipped with still reads.
_TITLE_KEYS = ('title', 'label', 'task', 'activity', 'name')
# ``location`` is the same mechanism, one concept later: rows once carried a
# free-text place ("Scena", "Foyer") that no editor ever offered, and a room
# inside the venue is what a description says. A point's actual venue is
# ``location_id``, which is a saved record and not text at all.
_DESCRIPTION_KEYS = ('description', 'notes', 'details', 'location')


class CallWindowProblem(StrEnum):
    """Why the arrival window cannot be stated as a fact. ``NONE`` is the only
    value on which a derived "X before the downbeat" line may be printed."""

    NONE = "none"
    MISSING = "missing"
    NOT_BEFORE = "not_before"
    IMPLAUSIBLE = "implausible"


@dataclass(frozen=True)
class CallWindow:
    """Both ends of the arrival window in the project's own clock, plus what is
    wrong with them.

    ``crosses_day`` is a display requirement, not a fault: an evening call for a
    morning concert is ordinary on tour. It means no surface may print the call
    as a bare hour — an hour without its date reads as concert-day, which is the
    single most dangerous thing a call sheet can get wrong.
    """

    call_local: datetime | None
    event_local: datetime | None
    buffer_minutes: int | None
    problem: CallWindowProblem
    crosses_day: bool

    @property
    def is_stated(self) -> bool:
        """True when the window may be presented as a derived fact."""
        return self.problem is CallWindowProblem.NONE and self.buffer_minutes is not None


class TimelineEntryKind(StrEnum):
    """An entry is either one of the day's two fixed anchors or an editable
    point between them."""

    CALL = "call"
    CONCERT = "concert"
    POINT = "point"


@dataclass(frozen=True)
class RunSheetPoint:
    """One row of ``Project.run_sheet``, read out of unvalidated JSON.

    ``time`` is a bare wall-clock ``HH:MM`` in the project's zone when it could
    be parsed, the raw string when it could not, and empty when the row has none
    — the field is edited live, so a half-typed row is a normal state, not a
    fault.

    ``location_id`` is a saved ``logistics.Location``, set only when the point
    happens somewhere OTHER than the event's venue — the coach departure, the
    lunch stop on the way. A stored venue rather than typed text because the
    answer a singer needs at a car park at 6:40 is a route, and only a venue
    carries the address one can be built from. Empty is not "unknown": a
    run-sheet point has always meant the event's own venue, and every surface
    reads it that way. Anything finer than a venue — a room, a door — is the
    description's job; a second free-text place field only splits one thought
    across two boxes.
    """

    time: str
    title: str
    description: str
    location_id: str


@dataclass(frozen=True)
class TimelineEntry:
    """A placed entry of the day. ``point`` is set only for ``POINT`` entries;
    anchors carry their own time and, when the call sits on another calendar
    day, the offset that says so."""

    kind: TimelineEntryKind
    time: str
    day_offset: int
    point: RunSheetPoint | None = None

    @property
    def is_anchor(self) -> bool:
        return self.kind is not TimelineEntryKind.POINT


def localize(value: datetime | None, timezone_name: str | None) -> datetime | None:
    """A datetime in the given IANA zone, falling back to UTC for an unknown one
    rather than raising — a mistyped zone must not take a document down."""
    if not value:
        return None
    try:
        target = zoneinfo.ZoneInfo(timezone_name or "UTC")
    except (zoneinfo.ZoneInfoNotFoundError, ValueError):
        target = zoneinfo.ZoneInfo("UTC")
    return timezone.localtime(value, target)


def resolve_call_window(
    call_time: datetime | None,
    event_time: datetime | None,
    timezone_name: str | None,
) -> CallWindow:
    """Resolve the arrival window, both ends localized to the project's clock."""
    call_local = localize(call_time, timezone_name)
    event_local = localize(event_time, timezone_name)

    if call_local is None or event_local is None:
        return CallWindow(
            call_local=call_local,
            event_local=event_local,
            buffer_minutes=None,
            problem=CallWindowProblem.MISSING,
            crosses_day=False,
        )

    buffer_minutes = int((event_local - call_local).total_seconds() // 60)
    crosses_day = call_local.date() != event_local.date()

    if buffer_minutes <= 0:
        problem = CallWindowProblem.NOT_BEFORE
    elif buffer_minutes > MAX_PLAUSIBLE_BUFFER_MINUTES:
        problem = CallWindowProblem.IMPLAUSIBLE
    else:
        problem = CallWindowProblem.NONE

    return CallWindow(
        call_local=call_local,
        event_local=event_local,
        buffer_minutes=buffer_minutes,
        problem=problem,
        crosses_day=crosses_day,
    )


def parse_clock_minutes(value: str) -> int | None:
    """Minutes since midnight for ``H:MM``/``HH:MM``. ``None`` for anything else
    — the caller decides what an unreadable time means, because the editor and
    the printed sheet answer that differently."""
    hours, separator, minutes = value.strip().partition(':')
    if not separator:
        return None
    try:
        parsed = int(hours) * 60 + int(minutes)
    except ValueError:
        return None
    if not 0 <= parsed < MINUTES_PER_DAY:
        return None
    return parsed


def format_clock(minutes: int) -> str:
    hours, remainder = divmod(minutes, 60)
    return f'{hours:02d}:{remainder:02d}'


def format_time_window(start: time | None, end: time | None) -> str | None:
    """Both ends of a typed day window (warm-up, sound check) as one value.

    The window is one fact stored in two columns, and every surface that states
    it outside the day's axis reads it as a pair for that reason: a value naming
    an hour without saying whether it opens or closes the sound check is worse
    than no value at all. An open window — a start with no end — is the normal
    case and states only the hour it opens.
    """
    if start is None:
        return None
    if end is None:
        return start.strftime('%H:%M')
    return f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}"


def clock_sort_key(value: str) -> tuple[int, int]:
    """Sort key for a run-sheet time. Unparsable entries sort last rather than
    being dropped or guessed at; their relative order is the input's, because a
    stable sort keeps it."""
    minutes = parse_clock_minutes(value)
    return (1, 0) if minutes is None else (0, minutes)


def normalize_run_sheet(run_sheet: Any) -> list[RunSheetPoint]:
    """Read ``Project.run_sheet`` — an unvalidated ``JSONField`` — into points.

    Sorting belongs here, not in :func:`build_day_timeline`: this is the
    *stored* day, and a manager who enters points out of order still prints a
    clean timeline. Lexically ``"9:00"`` follows ``"12:00"``, so the key is the
    parsed minute. The live editor sorts on commit instead (a row being typed
    must not jump), which is why the merge itself never reorders.
    """
    points: list[RunSheetPoint] = []
    for item in run_sheet or []:
        if not isinstance(item, dict):
            continue
        raw_time = str(item.get('time', '')).strip()
        minutes = parse_clock_minutes(raw_time)
        title = next(
            (str(item[key]).strip() for key in _TITLE_KEYS if item.get(key)),
            'Punkt dnia',
        )
        description = next(
            (str(item[key]).strip() for key in _DESCRIPTION_KEYS if item.get(key)),
            '',
        )
        points.append(
            RunSheetPoint(
                # Canonical zero-padded form so the printed time gutter aligns
                # with the anchors, which are formatted from real datetimes.
                time=format_clock(minutes) if minutes is not None else raw_time,
                title=title,
                description=description,
                location_id=str(item.get('location_id') or '').strip(),
            )
        )
    points.sort(key=lambda point: clock_sort_key(point.time))
    return points


def _anchor_sort_key(anchor: TimelineEntry) -> float:
    minutes = parse_clock_minutes(anchor.time) or 0
    # Tie-break, so a point sharing an anchor's minute reads as happening inside
    # the day the anchors bracket rather than before it opens or after it ends.
    nudge = -0.5 if anchor.kind is TimelineEntryKind.CALL else 0.5
    return anchor.day_offset * MINUTES_PER_DAY + minutes + nudge


def _build_anchors(window: CallWindow) -> list[TimelineEntry]:
    anchors: list[TimelineEntry] = []
    if window.call_local is not None:
        day_offset = (
            0
            if window.event_local is None
            else (window.call_local.date() - window.event_local.date()).days
        )
        anchors.append(
            TimelineEntry(
                kind=TimelineEntryKind.CALL,
                time=window.call_local.strftime('%H:%M'),
                day_offset=day_offset,
            )
        )
    if window.event_local is not None:
        anchors.append(
            TimelineEntry(
                kind=TimelineEntryKind.CONCERT,
                time=window.event_local.strftime('%H:%M'),
                day_offset=0,
            )
        )
    anchors.sort(key=_anchor_sort_key)
    return anchors


def build_day_timeline(
    points: Sequence[RunSheetPoint],
    window: CallWindow,
) -> list[TimelineEntry]:
    """Merge the anchors INTO the points without reordering the points.

    The concert day is the run sheet's implicit frame: a point stores a bare
    ``HH:MM`` and therefore cannot say "the evening before", while an anchor
    carries a real date and is placed by the offset between them. That
    asymmetry is deliberate — it mirrors what the field can hold — so a call the
    night before opens the list and everything typed into the run sheet belongs
    to concert day.

    The points arrive in the order the caller settled on (:func:`normalize_run_sheet`
    for stored data, the form's own commit order for the live editor), which is
    why this never sorts them: on the panel a half-typed time would otherwise
    yank the row being edited out from under the cursor.
    """
    anchors = _build_anchors(window)

    # An unset or unreadable time inherits its predecessor's position, so a row
    # mid-edit stays between the same neighbours instead of collapsing to the
    # start of the day.
    carried = 0
    point_keys: list[int] = []
    for point in points:
        minutes = parse_clock_minutes(point.time)
        if minutes is not None:
            carried = minutes
        point_keys.append(carried)

    entries: list[TimelineEntry] = []
    next_anchor = 0
    for index, point in enumerate(points):
        while (
            next_anchor < len(anchors)
            and _anchor_sort_key(anchors[next_anchor]) < point_keys[index]
        ):
            entries.append(anchors[next_anchor])
            next_anchor += 1
        entries.append(
            TimelineEntry(
                kind=TimelineEntryKind.POINT,
                time=point.time,
                day_offset=0,
                point=point,
            )
        )

    entries.extend(anchors[next_anchor:])
    return entries


def plan_end(entries: Sequence[TimelineEntry]) -> TimelineEntry | None:
    """The last planned moment when the day runs past the downbeat.

    Only a run-sheet point can answer this: the end of a concert is not stored
    anywhere, and deriving it from summed piece durations would print a
    fabricated hour as a fact. When nothing is planned after the downbeat there
    is no end to state, and the caller shows one cell fewer.
    """
    if not entries:
        return None
    last = entries[-1]
    if last.kind is not TimelineEntryKind.POINT:
        return None
    return last if parse_clock_minutes(last.time) is not None else None


__all__ = [
    "MAX_PLAUSIBLE_BUFFER_MINUTES",
    "MINUTES_PER_DAY",
    "CallWindow",
    "CallWindowProblem",
    "RunSheetPoint",
    "TimelineEntry",
    "TimelineEntryKind",
    "build_day_timeline",
    "clock_sort_key",
    "format_clock",
    "format_time_window",
    "localize",
    "normalize_run_sheet",
    "parse_clock_minutes",
    "plan_end",
    "resolve_call_window",
]
