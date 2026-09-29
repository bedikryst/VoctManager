"""
@file day_timeline.py
@description The concert's plan as one axis: the two anchors a producer plans
    around — the call time and the downbeat — merged with the editable run-sheet
    points between them, plus the relation between the anchors themselves.
    Kept in one module because they are one fact: a call time is only meaningful
    *relative to* the concert, and the arithmetic has failure modes a bare
    subtraction states as truth (a call after the downbeat, or one entered on the
    wrong date, which prints as a plausible hour while sitting weeks away).
    The plan may span several days (an out-of-town concert is a trip): every
    point sits on a day counted from concert day, so the plan moves with the
    concert and a stored point without a day is simply on concert day.
    Every document and read-model that shows an arrival time or a day plan reads
    this, so none of them can invent its own threshold or its own ordering.
@architecture Enterprise SaaS 2026
@module roster/domain/day_timeline
"""

from __future__ import annotations

import zoneinfo
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, tzinfo
from enum import StrEnum
from typing import Any, overload

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

# The days a plan may reach, counted from concert day. A trip leaves the day
# before and may come back the day after; three either way leaves room for a
# longer journey without letting a mistyped value push a point into another
# week, where it would print as a plausible date.
MIN_DAY_OFFSET = -3
MAX_DAY_OFFSET = 3

# The one numeric date of every language-neutral value: a field change row, and
# a window stated off concert day. One format, so the two never disagree.
DATE_FORMAT = '%d.%m.%Y'

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

    ``day`` is the point's day counted from concert day, within
    ``MIN_DAY_OFFSET..MAX_DAY_OFFSET``: ``-1`` is the departure the day before.
    It is an offset and not a date, so moving the concert moves the whole plan.

    ``travellers_only`` marks a point that concerns only the singers who travel
    with the group — the departure, the journey, the hotel, the group's meals.
    A singer who joins on site still sees it, muted, because knowing where the
    group is has value; one plan with a mark beats two plans that can disagree.
    """

    time: str
    title: str
    description: str
    location_id: str
    day: int = 0
    travellers_only: bool = False


@dataclass(frozen=True)
class DayWindow:
    """One of the plan's two typed windows (warm-up, sound check) as stored:
    wall-clock ends on the day ``day`` names, counted from concert day. An
    open window has no ``end``; a window without a ``start`` is not planned."""

    start: time | None
    end: time | None
    day: int = 0


@dataclass(frozen=True)
class PlanMoment:
    """One dated moment of the plan and what it is, so a surface that states
    the moment can also say what happens then.

    ``point`` is set when a run-sheet point is the moment, and ``window`` names
    a typed window by its key in ``Project.day_windows()``; each surface names
    a window in its own words, which is why the key travels and not a title.
    Neither set means one of the two anchors, the call or the downbeat.
    """

    at: datetime
    day_offset: int
    point: RunSheetPoint | None = None
    window: str = ''

    @property
    def is_anchor(self) -> bool:
        return self.point is None and not self.window


@dataclass(frozen=True)
class PlanBounds:
    """The first and the last moment of a plan, in the project's zone.

    ``last`` is ``None`` when nothing is planned after the downbeat: the end of
    a concert is not stored anywhere, and a caller that needs one supplies its
    own stated fallback rather than this module inventing an hour.
    """

    first: PlanMoment
    last: PlanMoment | None

    @property
    def start(self) -> datetime:
        return self.first.at

    @property
    def end(self) -> datetime | None:
        return self.last.at if self.last is not None else None

    @property
    def opens_before_call(self) -> bool:
        """Whether the reader is due somewhere before the call: the departure
        for a traveller, the acoustic rehearsal the evening before for a singer
        who joins on site. An anchor wins a tie, so with a stated call this is
        strictly earlier. A surface that shows only the call would otherwise
        let a traveller conclude they may arrive on concert day."""
        return not self.first.is_anchor


@dataclass(frozen=True)
class TimelineEntry:
    """A placed entry of the plan. ``point`` is set only for ``POINT`` entries.
    ``day_offset`` is the entry's day counted from concert day: a point's own
    ``day``, and for an anchor the distance between its date and the
    concert's."""

    kind: TimelineEntryKind
    time: str
    day_offset: int
    point: RunSheetPoint | None = None

    @property
    def is_anchor(self) -> bool:
        return self.kind is not TimelineEntryKind.POINT


def _resolve_zone(timezone_name: str | None) -> zoneinfo.ZoneInfo:
    """The given IANA zone, falling back to UTC for an unknown one rather than
    raising — a mistyped zone must not take a document down."""
    try:
        return zoneinfo.ZoneInfo(timezone_name or "UTC")
    except (zoneinfo.ZoneInfoNotFoundError, ValueError):
        return zoneinfo.ZoneInfo("UTC")


@overload
def localize(value: datetime, timezone_name: str | None) -> datetime: ...
@overload
def localize(value: None, timezone_name: str | None) -> None: ...
@overload
def localize(value: datetime | None, timezone_name: str | None) -> datetime | None: ...
def localize(value: datetime | None, timezone_name: str | None) -> datetime | None:
    """A datetime in the given IANA zone (UTC for an unknown one)."""
    if not value:
        return None
    return timezone.localtime(value, _resolve_zone(timezone_name))


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


def format_day_window(window: DayWindow, concert_date: date) -> str | None:
    """A typed window as one value that also says which day it is on.

    On concert day it is the bare pair of hours, as every surface has always
    read it. Off concert day the date comes first, because an hour without its
    date reads as concert day — the acoustic rehearsal the evening before would
    otherwise read as a Sunday appointment. Minute precision on both counts, so
    two windows that state the same are the same.
    """
    hours = format_time_window(window.start, window.end)
    if hours is None or window.day == 0:
        return hours
    on = concert_date + timedelta(days=window.day)
    return f"{on.strftime(DATE_FORMAT)} {hours}"


def clock_sort_key(value: str) -> tuple[int, int]:
    """Sort key for a run-sheet time. Unparsable entries sort last rather than
    being dropped or guessed at; their relative order is the input's, because a
    stable sort keeps it."""
    minutes = parse_clock_minutes(value)
    return (1, 0) if minutes is None else (0, minutes)


def point_sort_key(point: RunSheetPoint) -> tuple[int, int, int]:
    """Sort key for a point of the plan: its day, then its clock. An unreadable
    time sorts last *within its day*, not after the whole trip, because the day
    is the one part of the row that was chosen from a list and is always
    meaningful. The panel's editor (``dayTimeline.ts``) must order its rows by
    this same rule, or the edited plan and the printed one disagree."""
    return (point.day, *clock_sort_key(point.time))


def is_day_offset(value: Any) -> bool:
    """Whether a stored value is a day of the plan: an ``int`` within
    ``MIN_DAY_OFFSET..MAX_DAY_OFFSET``. ``bool`` is an ``int`` subclass and is
    refused, because a stray ``true`` must not read as the day after the
    concert. Strings are not coerced: the editor writes numbers."""
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and MIN_DAY_OFFSET <= value <= MAX_DAY_OFFSET
    )


def _read_day_offset(value: Any) -> int:
    """A stored day offset, or concert day for anything that is not one. The
    run sheet is JSON that writes validate but older rows never passed through,
    so the reader never raises."""
    return value if is_day_offset(value) else 0


def normalize_run_sheet(run_sheet: Any) -> list[RunSheetPoint]:
    """Read ``Project.run_sheet`` — a ``JSONField`` of free-form rows — into
    points. Writes check only the two keys a wrong value of which would
    silently move a point (``day``, ``travellers_only``); every row stored
    before that, and every other key, is read here and nowhere else.

    Sorting belongs here, not in :func:`build_day_timeline`: this is the
    *stored* plan, and a manager who enters points out of order still prints a
    clean timeline. Lexically ``"9:00"`` follows ``"12:00"``, so the key is the
    parsed minute within the point's day (:func:`point_sort_key`). The live
    editor sorts on commit instead (a row being typed must not jump), which is
    why the merge itself never reorders.
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
                day=_read_day_offset(item.get('day')),
                # Only a real ``true``: a truthy string or number is not the
                # editor's toggle, and a point due for everyone is the safe
                # reading of a value nothing wrote on purpose.
                travellers_only=item.get('travellers_only') is True,
            )
        )
    points.sort(key=point_sort_key)
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

    Concert day is the plan's frame: a point stores a bare ``HH:MM`` on the day
    its ``day`` offset names, while an anchor carries a real date and is placed
    by the distance between its date and the concert's. Both land on one axis
    of minutes from the start of concert day, so a departure the day before
    opens the list and a call the evening before sits among that evening's
    points.

    The points arrive in the order the caller settled on (:func:`normalize_run_sheet`
    for stored data, the form's own commit order for the live editor), which is
    why this never sorts them: on the panel a half-typed time would otherwise
    yank the row being edited out from under the cursor.
    """
    anchors = _build_anchors(window)

    # An unset or unreadable time inherits its predecessor's position, so a row
    # mid-edit stays between the same neighbours instead of collapsing to the
    # start of the day. The position is clamped to the point's own day: every
    # surface groups the plan under a heading per day, and an entry placed on a
    # neighbouring day would split its day's group in two. The seed is the
    # start of the earliest day, so a first point without a time opens its day.
    carried = MIN_DAY_OFFSET * MINUTES_PER_DAY
    point_keys: list[int] = []
    for point in points:
        day_start = point.day * MINUTES_PER_DAY
        minutes = parse_clock_minutes(point.time)
        if minutes is not None:
            carried = day_start + minutes
        else:
            carried = min(max(carried, day_start), day_start + MINUTES_PER_DAY - 1)
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
                day_offset=point.day,
                point=point,
            )
        )

    entries.extend(anchors[next_anchor:])
    return entries


def is_multi_day(entries: Sequence[TimelineEntry]) -> bool:
    """Whether the plan reaches past concert day — any entry, the call
    included. There is no switch for a trip: a plan with a point the evening
    before is one, and every surface then groups it under a heading per day."""
    return any(entry.day_offset != 0 for entry in entries)


def _instant_on_day(
    concert_date: date, day: int, clock: time, zone: tzinfo | None
) -> datetime:
    """A wall-clock time on the plan's ``day`` as a real instant. The offset is
    resolved for that date, so a trip across a DST change keeps its hours."""
    return datetime.combine(concert_date + timedelta(days=day), clock, tzinfo=zone)


def plan_bounds(
    points: Sequence[RunSheetPoint],
    window: CallWindow,
    day_windows: Mapping[str, DayWindow],
    *,
    include_travellers_only: bool,
) -> PlanBounds | None:
    """The first moment of the plan and its last planned moment after the
    downbeat, for one reader. ``day_windows`` is ``Project.day_windows()``.

    ``include_travellers_only=False`` is a singer who joins on site: the
    departure, the journey and the hotel are not theirs, so their plan starts
    at the first point they are due at. The two windows and the concert count
    for everyone — the warm-up and sound check are music. So does the call, but
    only while :func:`resolve_call_window` can state it: a call typed on the
    wrong date, or after the downbeat, would otherwise open the plan weeks
    early or close it on an hour nobody planned.

    Every wall-clock value is placed in the zone the downbeat was localized
    in, so the plan cannot be counted in one zone and dated in another. A
    point without a readable time has no instant and is skipped; it cannot
    open or close the plan. The anchors come first among the candidates, so
    a point sharing the call's minute leaves the call opening the plan and a
    point at the downbeat's minute does not end it. ``None`` only when there
    is no downbeat to count the days from.
    """
    concert = window.event_local
    if concert is None:
        return None
    zone = concert.tzinfo
    concert_date = concert.date()

    moments: list[PlanMoment] = [PlanMoment(at=concert, day_offset=0)]
    if window.is_stated and window.call_local is not None:
        moments.append(
            PlanMoment(
                at=window.call_local,
                day_offset=(window.call_local.date() - concert_date).days,
            )
        )
    for key, day_window in day_windows.items():
        if day_window.start is None:
            continue
        for clock in (day_window.start, day_window.end):
            if clock is None:
                continue
            moments.append(
                PlanMoment(
                    at=_instant_on_day(concert_date, day_window.day, clock, zone),
                    day_offset=day_window.day,
                    window=key,
                )
            )
    for point in points:
        if point.travellers_only and not include_travellers_only:
            continue
        minutes = parse_clock_minutes(point.time)
        if minutes is None:
            continue
        clock = time(hour=minutes // 60, minute=minutes % 60)
        moments.append(
            PlanMoment(
                at=_instant_on_day(concert_date, point.day, clock, zone),
                day_offset=point.day,
                point=point,
            )
        )

    # Compared as instants: two wall-clock values in one zone compare by their
    # face, which is wrong inside the hour a DST change repeats. ``min`` and
    # ``max`` keep the first of equals, which is what lets the anchors win.
    first = min(moments, key=lambda moment: moment.at.timestamp())
    last = max(moments, key=lambda moment: moment.at.timestamp())
    return PlanBounds(
        first=first,
        last=last if last.at.timestamp() > concert.timestamp() else None,
    )


__all__ = [
    "DATE_FORMAT",
    "MAX_DAY_OFFSET",
    "MAX_PLAUSIBLE_BUFFER_MINUTES",
    "MINUTES_PER_DAY",
    "MIN_DAY_OFFSET",
    "CallWindow",
    "CallWindowProblem",
    "DayWindow",
    "PlanBounds",
    "PlanMoment",
    "RunSheetPoint",
    "TimelineEntry",
    "TimelineEntryKind",
    "build_day_timeline",
    "clock_sort_key",
    "format_clock",
    "format_day_window",
    "format_time_window",
    "is_day_offset",
    "is_multi_day",
    "localize",
    "normalize_run_sheet",
    "parse_clock_minutes",
    "plan_bounds",
    "point_sort_key",
    "resolve_call_window",
]
