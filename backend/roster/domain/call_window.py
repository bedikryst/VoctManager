"""
@file call_window.py
@description The relation between a project's call time and its downbeat, as one
    resolved fact rather than two datetimes each surface subtracts for itself.
    A call time is only meaningful *relative to* the concert, and the arithmetic
    has failure modes a bare subtraction states as truth: a call after the
    downbeat, or one entered on the wrong date, which prints as a plausible hour
    while sitting weeks away. Every document and read-model that shows an
    arrival time reads this, so none of them can invent its own threshold.
@architecture Enterprise SaaS 2026
@module roster/domain/call_window
"""

from __future__ import annotations

import zoneinfo
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

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


__all__ = [
    "MAX_PLAUSIBLE_BUFFER_MINUTES",
    "CallWindow",
    "CallWindowProblem",
    "localize",
    "resolve_call_window",
]
