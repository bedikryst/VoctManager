"""
@file push_fold.py
@description One push per singer's burst of attendance reports. A singer ticking
             five rehearsals in a row is one piece of news for the conductor, so
             the push of each report waits in a sliding window per (manager,
             singer). The window closes after `ATTENDANCE_PUSH_QUIET_SECONDS`
             without a new report, or `ATTENDANCE_PUSH_CEILING_SECONDS` after it
             opened, and one push then names everything that arrived in it.

             Only push folds. The in-app row stays one per event — the bell is
             the record — and the router answers e-mail and the digest per event.

             The cache holds three kinds of key per pair, none of them a list to
             append to: one member key per report, set in one write; the gate,
             holding when the window opened, which only `cache.add` creates; and
             the stamp of the latest report. Each report schedules its own flush,
             and a flush never schedules another: under eager Celery a
             re-scheduled task runs inline and recurses.
@architecture Enterprise SaaS 2026
@module notifications/push_fold
"""
from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .message_content import FOLD_ITEMS_KEY, FOLD_TYPES, NOTIFICATION_IDS_KEY, _is_span
from .models import Notification, NotificationLevel, NotificationType
from .tasks import flush_push_fold_task, send_push_notification_task
from .time_metadata import event_start

# How far back a flush looks for the rows its member keys name. A window lasts
# at most the ceiling; the rest is room for a flush a busy worker picks up late.
_ROW_LOOKBACK = timedelta(minutes=10)

# The keys outlive the ceiling by this much, for the same late flush.
_KEY_MARGIN_SECONDS = 5 * 60

_LEVEL_RANK: dict[str, int] = {
    NotificationLevel.INFO: 0,
    NotificationLevel.WARNING: 1,
    NotificationLevel.URGENT: 2,
}


def quiet_seconds() -> int:
    return int(getattr(settings, "ATTENDANCE_PUSH_QUIET_SECONDS", 10))


def ceiling_seconds() -> int:
    return int(getattr(settings, "ATTENDANCE_PUSH_CEILING_SECONDS", 60))


def _key_timeout() -> int:
    return ceiling_seconds() + _KEY_MARGIN_SECONDS


def _member_key(recipient_id: str, artist_id: str, notification_id: Any) -> str:
    return f"push-fold:{recipient_id}:{artist_id}:n:{notification_id}"


def _gate_key(recipient_id: str, artist_id: str) -> str:
    return f"push-fold:{recipient_id}:{artist_id}:gate"


def _last_key(recipient_id: str, artist_id: str) -> str:
    return f"push-fold:{recipient_id}:{artist_id}:last"


def is_foldable(notification_type: str, metadata: dict[str, Any]) -> bool:
    """A singer's report about one evening: attendance, or an absence for a single
    rehearsal. An absence span is already one message per production and pushes
    on its own."""
    return (
        notification_type in FOLD_TYPES
        and bool(metadata.get("artist_id"))
        and not _is_span(metadata)
    )


def hold(*, recipient_id: str, artist_id: str, notification_id: str) -> None:
    """Put one report's push into its singer's window, and schedule a flush for
    the moment the window would close if no other report followed it.

    The notification id doubles as the stamp: it is unique per report, and a
    flush only needs to know whether its report is still the latest one.
    """
    timeout = _key_timeout()
    # The member goes in first, so a flush that runs the instant it is scheduled
    # (eager mode, an idle worker) already finds it.
    cache.set(_member_key(recipient_id, artist_id, notification_id), True, timeout=timeout)
    cache.add(_gate_key(recipient_id, artist_id), time.time(), timeout=timeout)
    cache.set(_last_key(recipient_id, artist_id), notification_id, timeout=timeout)
    flush_push_fold_task.apply_async(
        args=[recipient_id, artist_id, notification_id], countdown=quiet_seconds(),
    )


def flush(*, recipient_id: str, artist_id: str, stamp: str) -> int:
    """Close the window if this flush is the one due, and push what it gathered.

    Due means no report followed the one that scheduled this flush, or the window
    has stayed open for the ceiling. Otherwise a later flush is on its way and
    this one returns. Returns how many reports the push carried.

    A report racing the flush is either taken by it — its member key then gone,
    so its own flush finds nothing and returns — or left for a window of its own.
    Nothing is lost and nothing is pushed twice.
    """
    gate_key = _gate_key(recipient_id, artist_id)
    opened_at = cache.get(gate_key)
    ceiling_reached = (
        opened_at is not None and time.time() - float(opened_at) >= ceiling_seconds()
    )
    if cache.get(_last_key(recipient_id, artist_id)) != stamp and not ceiling_reached:
        return 0

    # Reopen first: a report from here on starts a window of its own rather than
    # joining a push that is already being composed.
    cache.delete(gate_key)

    rows = Notification.objects.filter(
        recipient_id=int(recipient_id),
        notification_type__in=FOLD_TYPES,
        metadata__artist_id=artist_id,
        created_at__gte=timezone.now() - _ROW_LOOKBACK,
    ).order_by("created_at")
    # Deleting a member key is the claim: of two flushes reaching one report,
    # only one deletes its key.
    taken = [
        row for row in rows
        if cache.delete(_member_key(recipient_id, artist_id, row.id))
    ]
    if not taken:
        return 0

    _push(recipient_id, artist_id, taken)
    return len(taken)


def _latest_per_rehearsal(rows: list[Notification]) -> list[Notification]:
    """One row per rehearsal, the latest report winning, in rehearsal order.

    A singer who marks an evening "present" and then "late" has said one thing,
    and it is the second."""
    latest: dict[str, Notification] = {}
    for row in rows:
        rehearsal_id = (row.metadata or {}).get("rehearsal_id")
        latest[str(rehearsal_id) if rehearsal_id else f"row:{row.id}"] = row

    def starts(row: Notification) -> float:
        moment = event_start(row.metadata or {})
        return moment.timestamp() if moment else float("inf")

    return sorted(latest.values(), key=starts)


def _push(recipient_id: str, artist_id: str, rows: list[Notification]) -> None:
    """One push for the rows a window gathered.

    A single report after deduplication is pushed exactly as it would have been
    alone. Several are composed together, riding on the absence type when any of
    them is an absence, at the level of the most urgent one.

    No e-mail travels in reserve: the router has already answered e-mail per
    event, and no team type is push-first.
    """
    notification_ids = [str(row.id) for row in rows]
    items = _latest_per_rehearsal(rows)

    if len(items) == 1:
        (row,) = items
        send_push_notification_task.delay(
            recipient_id=recipient_id,
            notification_type=row.notification_type,
            metadata={**(row.metadata or {}), NOTIFICATION_IDS_KEY: notification_ids},
            level=row.level,
            email_fallback=None,
        )
        return

    notification_type = (
        NotificationType.ABSENCE_REQUESTED
        if any(row.notification_type == NotificationType.ABSENCE_REQUESTED for row in items)
        else NotificationType.ATTENDANCE_SUBMITTED
    )
    level = max((row.level for row in items), key=lambda value: _LEVEL_RANK.get(value, 0))
    artist_name = next(
        (row.metadata["artist_name"] for row in items if (row.metadata or {}).get("artist_name")),
        "",
    )
    send_push_notification_task.delay(
        recipient_id=recipient_id,
        notification_type=notification_type,
        metadata={
            "artist_id": artist_id,
            "artist_name": artist_name,
            NOTIFICATION_IDS_KEY: notification_ids,
            FOLD_ITEMS_KEY: [
                {**(row.metadata or {}), "notification_type": row.notification_type}
                for row in items
            ],
        },
        level=level,
        email_fallback=None,
    )
