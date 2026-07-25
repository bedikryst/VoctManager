"""
@file announcements.py
@description Single gate between a project write and the artists it would notify,
             and the one place that decides which of three things happens to it.

             **Silence** while the project is a DRAFT: the conductor adds people,
             moves rehearsals and reshuffles divisi without a message leaving the
             app. **The queue** once it is live: an edit lands in the database at
             once but waits here to be told, so five rehearsal changes become one
             piece of news and a typo corrected a minute later reaches nobody.
             **Immediate** for the few events the queue must not hold — the
             invitation that publishes the project, a cancellation, and being
             taken off a cast, which are either the announcement itself or leave
             the recipient with nothing to open in the app.

             Every artist-facing project emitter routes through here instead of
             calling the dispatch tasks directly, so the rule lives in one place.
             The queue's mechanics live in announcement_queue.py; this module owns
             only the choice between the three.

             Manager-facing signals (attendance, RSVP, absence requests) and the
             manager digest are a different axis entirely and never come through
             this module.
@architecture Enterprise SaaS 2026
@module notifications/announcements
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from django.db import transaction

from .announcement_queue import AnnouncementQueue
from .models import NotificationLevel, NotificationType
from .tasks import send_bulk_notifications_task, send_notification_task

if TYPE_CHECKING:
    from roster.models import Project

logger = logging.getLogger(__name__)

# Every event type that may wait in the queue, declared rather than inferred.
#
# Two things depend on knowing this set, and neither can derive it from the call
# sites. A queued event may be folded into a PROJECT_BRIEFING, which is one type
# carrying several — so every member here has to share one preference group, or
# the fold would deliver news past a switch the reader had turned off (see
# NotificationRouter._route_briefing, which enforces that per item, and
# test_everything_a_briefing_can_carry_shares_one_group, which reads this set).
# The alternative — a list written out in a test — cannot fail for the case it
# exists for: a new queued emitter simply would not appear in it.
QUEUEABLE_TYPES: frozenset[str] = frozenset({
    NotificationType.PROJECT_UPDATED,
    NotificationType.REHEARSAL_SCHEDULED,
    NotificationType.REHEARSAL_UPDATED,
    NotificationType.PIECE_CASTING_ASSIGNED,
    NotificationType.PIECE_CASTING_UPDATED,
})


def _assert_queueable(notification_type: str) -> None:
    """Refuse to queue a type that has not been declared above.

    Loud on purpose, and the same bargain `assert_preference_policy_is_coherent`
    strikes at boot: an undeclared type would queue, fold and deliver perfectly
    well while quietly bypassing the group its reader answers for. A new emitter
    registers itself here or fails the first time it fires.
    """
    if notification_type not in QUEUEABLE_TYPES:
        raise ValueError(
            f"[{notification_type}] is not declared in QUEUEABLE_TYPES — a queued type "
            "must share a preference group with everything else a briefing can carry."
        )


def is_announceable(project: Project | None) -> bool:
    """Whether artists may hear about this project at all.

    A missing project is treated as announceable: callers that cannot resolve one
    are outside the draft lifecycle, and silence would be the surprising default.
    """
    if project is None:
        return True

    from roster.models import Project as ProjectModel

    return project.status != ProjectModel.Status.DRAFT


def announce(
    *,
    project: Project | None,
    recipient_id: str,
    notification_type: str,
    level: str = NotificationLevel.INFO,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Announce a single-recipient project event, once the surrounding transaction commits."""
    if not is_announceable(project):
        _log_withheld(project, notification_type, 1)
        return

    payload = metadata or {}
    transaction.on_commit(
        lambda: send_notification_task.delay(
            recipient_id=str(recipient_id),
            notification_type=notification_type,
            level=level,
            metadata=payload,
        )
    )


def announce_bulk(
    *,
    project: Project | None,
    recipient_ids: list[str],
    notification_type: str,
    level: str = NotificationLevel.INFO,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Announce a project event to a cast, once the surrounding transaction commits."""
    if not recipient_ids:
        return

    if not is_announceable(project):
        _log_withheld(project, notification_type, len(recipient_ids))
        return

    payload = metadata or {}
    transaction.on_commit(
        lambda: send_bulk_notifications_task.delay(
            recipient_ids=recipient_ids,
            notification_type=notification_type,
            level=level,
            metadata=payload,
        )
    )


def queue_announcement(
    *,
    project: Project,
    recipient_id: str,
    subject_type: str,
    subject_id: str,
    kind: str,
    notification_type: str,
    level: str = NotificationLevel.INFO,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Hold a change addressed to one artist until the conductor publishes it."""
    _assert_queueable(notification_type)
    if not is_announceable(project):
        _log_withheld(project, notification_type, 1)
        return

    AnnouncementQueue.enqueue(
        project=project,
        recipient_id=str(recipient_id),
        subject_type=subject_type,
        subject_id=subject_id,
        kind=kind,
        notification_type=notification_type,
        level=level,
        metadata=metadata,
    )


def queue_broadcast(
    *,
    project: Project,
    subject_type: str,
    subject_id: str,
    kind: str,
    notification_type: str,
    level: str = NotificationLevel.INFO,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Hold a change addressed to the cast until the conductor publishes it.

    Unlike `announce_bulk` this takes no recipients: who hears a queued broadcast
    is resolved from the live cast at publish time, so someone who confirms in the
    meantime is included rather than missed.
    """
    _assert_queueable(notification_type)
    if not is_announceable(project):
        _log_withheld(project, notification_type, None)
        return

    AnnouncementQueue.enqueue(
        project=project,
        subject_type=subject_type,
        subject_id=subject_id,
        kind=kind,
        notification_type=notification_type,
        level=level,
        metadata=metadata,
    )


def _log_withheld(project: Project | None, notification_type: str, recipients: int | None) -> None:
    """`recipients` is None for an audience that would only have been resolved
    later — a queued broadcast never gets that far on a draft."""
    project_id = getattr(project, "id", None)
    logger.info(
        "[Announcements] Withheld [%s] for %s: project %s is a draft.",
        notification_type,
        f"{recipients} recipient(s)" if recipients is not None else "the cast",
        project_id,
    )
