"""
@file push_fold.py
@description One message per singer's burst of attendance reports. A singer
             ticking five rehearsals in a row is one piece of news for the
             conductor, so each report waits in a sliding window per (manager,
             singer). The window closes after `ATTENDANCE_PUSH_QUIET_SECONDS`
             without a new report, or `ATTENDANCE_PUSH_CEILING_SECONDS` after it
             opened, and one push and one e-mail then name everything that
             arrived in it.

             Push and the e-mail sent now both fold. Each report owes the
             channels the router planned for it, and the window pays each channel
             only with the reports that owe it. A report held for the daily
             digest owes no e-mail here: the digest collects it on its own. The
             in-app row stays one per event — the bell is the record.

             The cache holds three kinds of key per pair, none of them a list to
             append to: one member key per report, set in one write, holding the
             channels it owes; the gate, holding when the window opened, which
             only `cache.add` creates; and the stamp of the latest report. Each
             report schedules its own flush, and a flush never schedules another:
             under eager Celery a re-scheduled task runs inline and recurses.
@architecture Enterprise SaaS 2026
@module notifications/push_fold
"""
from __future__ import annotations

import time
from datetime import timedelta
from typing import Any, TypedDict

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .email_tasks import send_notification_email_task
from .message_content import FOLD_ITEMS_KEY, FOLD_TYPES, NOTIFICATION_IDS_KEY, _is_span
from .models import Notification, NotificationLevel, NotificationType
from .tasks import flush_push_fold_task, send_push_notification_task
from .time_metadata import event_start

# Room past the window's own length for a flush a busy worker picks up late.
_KEY_MARGIN_SECONDS = 5 * 60

# The e-mail layout of both report types, the router's own default.
_EMAIL_TEMPLATE = "transactional"

_LEVEL_RANK: dict[str, int] = {
    NotificationLevel.INFO: 0,
    NotificationLevel.WARNING: 1,
    NotificationLevel.URGENT: 2,
}


class Owed(TypedDict):
    """The channels one held report is still to be delivered on."""
    push: bool
    email: bool


def quiet_seconds() -> int:
    """The gap between two reports of one sitting: a singer writing "why" for
    each evening spends most of a minute per row. A longer wait would hold the
    news of a single report back for no burst to join."""
    return int(getattr(settings, "ATTENDANCE_PUSH_QUIET_SECONDS", 60))


def ceiling_seconds() -> int:
    """The longest a report's push may wait, however long the sitting runs."""
    return int(getattr(settings, "ATTENDANCE_PUSH_CEILING_SECONDS", 300))


def _key_timeout() -> int:
    """A window's last flush runs up to a quiet period past the ceiling, and the
    keys and rows it reads must still be there when it does."""
    return ceiling_seconds() + quiet_seconds() + _KEY_MARGIN_SECONDS


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


def hold(
    *, recipient_id: str, artist_id: str, notification_id: str, push: bool, email: bool,
) -> None:
    """Put one report into its singer's window, owing the channels named, and
    schedule a flush for the moment the window would close if no other report
    followed it.

    The notification id doubles as the stamp: it is unique per report, and a
    flush only needs to know whether its report is still the latest one.
    """
    timeout = _key_timeout()
    owed: Owed = {"push": push, "email": email}
    # The member goes in first, so a flush that runs the instant it is scheduled
    # (eager mode, an idle worker) already finds it.
    cache.set(_member_key(recipient_id, artist_id, notification_id), owed, timeout=timeout)
    cache.add(_gate_key(recipient_id, artist_id), time.time(), timeout=timeout)
    cache.set(_last_key(recipient_id, artist_id), notification_id, timeout=timeout)
    flush_push_fold_task.apply_async(
        args=[recipient_id, artist_id, notification_id], countdown=quiet_seconds(),
    )


def flush(*, recipient_id: str, artist_id: str, stamp: str) -> int:
    """Close the window if this flush is the one due, and deliver what it gathered.

    Due means no report followed the one that scheduled this flush, or the window
    has stayed open for the ceiling. Otherwise a later flush is on its way and
    this one returns. Returns how many reports the window held.

    A report racing the flush is either taken by it — its member key then gone,
    so its own flush finds nothing and returns — or left for a window of its own.
    Nothing is lost and nothing is delivered twice.

    Each channel carries the latest report per rehearsal, and only where that
    report owes it. An evening marked absent and then present is not an absence
    to e-mail about, even though the absence was the report that owed the e-mail.
    """
    gate_key = _gate_key(recipient_id, artist_id)
    opened_at = cache.get(gate_key)
    ceiling_reached = (
        opened_at is not None and time.time() - float(opened_at) >= ceiling_seconds()
    )
    if cache.get(_last_key(recipient_id, artist_id)) != stamp and not ceiling_reached:
        return 0

    # Reopen first: a report from here on starts a window of its own rather than
    # joining a message that is already being composed.
    cache.delete(gate_key)

    rows = list(
        Notification.objects.filter(
            recipient_id=int(recipient_id),
            notification_type__in=FOLD_TYPES,
            metadata__artist_id=artist_id,
            created_at__gte=timezone.now() - timedelta(seconds=_key_timeout()),
        ).order_by("created_at")
    )
    # Deleting a member key is the claim: of two flushes reaching one report,
    # only one deletes its key.
    owed: dict[str, Owed] = {}
    for row in rows:
        key = _member_key(recipient_id, artist_id, row.id)
        channels = cache.get(key)
        if cache.delete(key):
            owed[str(row.id)] = _owed(channels)
    if not owed:
        return 0

    # Over every row of the singer, not only the claimed ones: a later report
    # that owes nothing (its e-mail waits for the digest, its push is off) still
    # says what the evening now is.
    current = [row for row in _latest_per_rehearsal(rows) if str(row.id) in owed]

    push_items = [row for row in current if owed[str(row.id)]["push"]]
    if push_items:
        _push(
            recipient_id, artist_id, push_items,
            notification_ids=[
                str(row.id) for row in rows
                if str(row.id) in owed and owed[str(row.id)]["push"]
            ],
        )

    email_items = [row for row in current if owed[str(row.id)]["email"]]
    if email_items:
        _email(recipient_id, artist_id, email_items)
    return len(owed)


def _owed(channels: object) -> Owed:
    """The channels a member key holds. A bare `True`, as a worker still on the
    previous release writes it during a deploy, owes push alone."""
    if isinstance(channels, dict):
        return {"push": bool(channels.get("push")), "email": bool(channels.get("email"))}
    return {"push": True, "email": False}


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


def _composed(
    artist_id: str, items: list[Notification],
) -> tuple[str, str, dict[str, Any]]:
    """Type, level and metadata of one message over the items of a window.

    A single item travels exactly as it would have alone. Several are composed
    together, riding on the absence type when any of them is an absence, at the
    level of the most urgent one.
    """
    if len(items) == 1:
        (row,) = items
        return row.notification_type, row.level, dict(row.metadata or {})

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
    return notification_type, level, {
        "artist_id": artist_id,
        "artist_name": artist_name,
        FOLD_ITEMS_KEY: [
            {**(row.metadata or {}), "notification_type": row.notification_type}
            for row in items
        ],
    }


def _push(
    recipient_id: str,
    artist_id: str,
    items: list[Notification],
    *,
    notification_ids: list[str],
) -> None:
    """One push for the items a window owes push, naming every in-app row it
    answers for — superseded reports of the same evening included.

    No e-mail travels in reserve: no team type is push-first, and the window
    pays the e-mail it owes itself.
    """
    notification_type, level, metadata = _composed(artist_id, items)
    send_push_notification_task.delay(
        recipient_id=recipient_id,
        notification_type=notification_type,
        metadata={**metadata, NOTIFICATION_IDS_KEY: notification_ids},
        level=level,
        email_fallback=None,
    )


def _email(recipient_id: str, artist_id: str, items: list[Notification]) -> None:
    """One e-mail for the items a window owes e-mail, composed as the push is."""
    notification_type, level, metadata = _composed(artist_id, items)
    send_notification_email_task.delay(
        recipient_id=recipient_id,
        notification_type=notification_type,
        template_name=_EMAIL_TEMPLATE,
        metadata=metadata,
        level=level,
    )
