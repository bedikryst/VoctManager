"""
@file attendance_window.py
@description How long a rehearsal stays a singer's own to answer for. Attendance
    has two authors with different rights over it: the singer, who *reports* what
    they are going to do, and the manager, whose roll call is the choir's record
    of what happened. This module holds the one line between them, so the single
    rehearsal, the span of days and the preview that counts them all read the
    same rule.
@architecture Enterprise SaaS 2026
@module roster/domain/attendance_window
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .day_timeline import localize

if TYPE_CHECKING:
    from roster.models import Rehearsal

SELF_REPORT_CLOSED_CODE = "attendance_window_closed"
SELF_REPORT_CLOSED_MESSAGE = _(
    "This rehearsal has already been held — its attendance is the roll call's "
    "record. Ask a manager to correct it."
)


def is_open_to_self_report(rehearsal: Rehearsal, *, now: datetime | None = None) -> bool:
    """True while the artist this row is about may still write it themselves.

    The boundary is the rehearsal's own calendar day, read on the venue clock —
    the same wall-clock reading a span of days is judged by, so "I'm away until
    the 21st" and "I couldn't make it tonight" cannot disagree about which day a
    rehearsal belongs to. Two consequences, both deliberate: a singer can still
    say "running late" or "I was ill" after the downbeat of an evening that is
    under way, and yesterday's evening is closed to them — marking one's own
    history PRESENT is rewriting the record, not reporting.

    A manager is never asked this question; correcting the past is their job.
    """
    local = localize(rehearsal.date_time, rehearsal.timezone)
    today = localize(now or timezone.now(), rehearsal.timezone)
    if local is None or today is None:
        # Both arguments are non-null in every caller, so this is unreachable in
        # practice; a mistyped zone must not be what locks a singer out.
        return True
    return local.date() >= today.date()
