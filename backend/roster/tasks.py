# roster/tasks.py
"""
Asynchronous background tasks for the Roster application.
Utilizes Celery and Redis to handle resource-intensive operations.
"""

import json
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from archive.models import Piece
from notifications.announcement_queue import AnnouncementQueue
from notifications.dtos import AnnouncementPendingMetadata
from notifications.models import NotificationLevel, NotificationType
from notifications.services import NotificationRecipientPolicy
from notifications.tasks import send_bulk_notifications_task
from notifications.time_metadata import build_event_time_metadata

from .domain.day_timeline import MIN_DAY_OFFSET, PlanBounds
from .models import (
    DEFAULT_EVENT_TIMEZONE,
    Participation,
    Project,
    Rehearsal,
)
from .queries.day_plan_queries import plan_start_metadata

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def generate_score_package_task(self, package_id: str):
    """
    Assemble a Project's concert score book (title + TOC + bound editions +
    numbering + bookmarks) and store it on ``Project.score_pdf``. The service
    owns all status transitions and always leaves the package in a terminal
    state, so this task is a thin, idempotent dispatcher.
    """
    from .score_package_service import ScorePackageService

    ScorePackageService.run_build(package_id)
    return {"package_id": package_id, "message": "done"}


# ──────────────────────────────────────────────────────────────────────────── #
# Upcoming-event reminders                                                      #
# Hourly beat sweep. Each rehearsal/project is reminded once, when it first      #
# enters its lead window; `reminder_sent_at` is claimed atomically so a second   #
# beat (or worker) cannot double-send.                                           #
# ──────────────────────────────────────────────────────────────────────────── #

def _dispatch_rehearsal_reminders(now) -> int:
    # Imported inside the function for the reason given in
    # `dispatch_announcement_nudges`: services.py pulls in the whole roster
    # service layer, and this module is loaded by every Celery worker at startup.
    from .services import (
        rehearsal_ics_payload,
        rehearsal_notification_context,
        rehearsal_plan_lines,
    )

    lead = timedelta(hours=getattr(settings, "REHEARSAL_REMINDER_LEAD_HOURS", 24))
    # Drafts are filtered here rather than after the claim below, so a rehearsal whose
    # project is published later is still reminded — skipping it must not burn its
    # one-shot `reminder_sent_at`.
    due = (
        Rehearsal.objects.filter(
            is_deleted=False,
            reminder_sent_at__isnull=True,
            date_time__gt=now,
            date_time__lte=now + lead,
        )
        .exclude(project__status__in=[Project.Status.CANCELLED, Project.Status.DRAFT])
    )
    ids = list(due.values_list("id", flat=True))
    if not ids:
        return 0

    # Claim atomically before dispatching — at-most-once beats duplicate spam.
    Rehearsal.objects.filter(id__in=ids).update(reminder_sent_at=now)

    sent = 0
    rehearsals = (
        Rehearsal.objects.filter(id__in=ids)
        .select_related("project", "location")
        .prefetch_related("invited_participations", "plan_items")
    )
    for reh in rehearsals:
        called = list(reh.called_participations().select_related("artist"))
        # The same two builders the scheduling and change announcements use, so
        # the reminder — the message most singers actually plan the evening from —
        # states the end the conductor entered instead of a block invented here.
        # A plan still in draft travels in neither form: no lines, no windows.
        metadata = {
            "project_name": reh.project.title,
            "project_id": str(reh.project_id),
            "rehearsal_id": str(reh.id),
            **rehearsal_notification_context(reh),
            "plan": rehearsal_plan_lines(reh, now),
            "ics": rehearsal_ics_payload(reh),
        }
        groups = _reminder_groups_by_window(reh, called, plan_public=reh.plan_is_public(now))
        if not groups:
            continue
        dispatched = 0
        for window, recipient_ids in groups:
            # Each group is its own hand-off to the broker. `reminder_sent_at`
            # is already claimed for the whole evening, so a group that fails
            # here is not retried by a later beat — but the groups after it,
            # and the remaining rehearsals in this sweep, must still go out.
            try:
                send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_REMINDER,
                    level=NotificationLevel.INFO,
                    metadata={**metadata, "my_window": window},
                )
            except Exception:
                logger.exception(
                    "rehearsal reminder: dispatch failed for rehearsal=%s window=%s "
                    "recipients=%d — these recipients get no reminder",
                    reh.id, window, len(recipient_ids),
                )
                continue
            dispatched += 1
        if dispatched:
            sent += 1
    return sent


def _reminder_groups_by_window(
    reh: Rehearsal, called: list[Participation], *, plan_public: bool,
) -> list[tuple[dict[str, object] | None, list[str]]]:
    """The evening's recipients, split into one group per distinct plan window.

    The reminder is the only rehearsal message addressed to one person at a
    time, so it is the only one that can name which part of the evening is
    theirs: a broadcast cannot personalise. Fanning out per window, not per person,
    keeps that promise at the cost of a handful of extra sends: an evening
    whose plan calls everybody the whole time stays a single dispatch.

    A plan the conductor has not sent (``plan_public`` false) states no window
    to anybody, so the evening goes out as one group — a window read off a
    draft would publish it one reader at a time.

    The recipient rule itself is never restated here: every seat goes through
    `NotificationRecipientPolicy`, one at a time, so who hears about an evening
    is decided in exactly one place.
    """
    from roster.domain.rehearsal_plan import window_payload
    from roster.queries.plan_queries import plan_windows_for_seats

    windows = plan_windows_for_seats(reh, called) if plan_public else {}
    grouped: dict[str, tuple[dict[str, object] | None, list[str]]] = {}
    for seat in called:
        recipients = NotificationRecipientPolicy.from_participations([seat])
        if not recipients:
            continue
        window = window_payload(windows.get(seat.id))
        key = json.dumps(window, sort_keys=True)
        grouped.setdefault(key, (window, []))[1].extend(recipients)
    return list(grouped.values())


def _dispatch_project_reminders(now) -> int:
    lead = timedelta(hours=getattr(settings, "PROJECT_REMINDER_LEAD_HOURS", 48))
    # The reminder is timed from the first moment of the whole plan, not from
    # the downbeat: a trip's departure can be days earlier, and a reminder timed
    # from the concert would arrive after the group has left. The query can only
    # see the downbeat, so it reaches as far ahead as a plan may start before it,
    # and the plan itself decides.
    candidates = Project.objects.filter(
        is_deleted=False,
        reminder_sent_at__isnull=True,
        date_time__gt=now,
        date_time__lte=now + lead + timedelta(days=-MIN_DAY_OFFSET),
        # A draft is invisible to its cast; reminding them of a concert they were
        # never told about would be the first they hear of it. Filtered before the
        # claim below so publishing later still leaves the reminder available.
        status=Project.Status.ACTIVE,
    ).select_related("location")
    due: list[tuple[Project, PlanBounds]] = []
    for proj in candidates:
        bounds = proj.plan_bounds(include_travellers_only=True)
        if bounds is not None and bounds.start <= now + lead:
            due.append((proj, bounds))
    if not due:
        return 0

    # Claimed for the kept projects only: a concert whose plan has not yet
    # entered the lead window must still be reminded by a later beat.
    Project.objects.filter(id__in=[proj.id for proj, _ in due]).update(reminder_sent_at=now)

    sent = 0
    for proj, whole_plan in due:
        dispatched = 0
        for recipient_ids, bounds in _reminder_groups_by_plan(proj, whole_plan):
            # Each group is its own hand-off to the broker, as with the
            # rehearsal reminder: `reminder_sent_at` is already claimed, so a
            # group that fails here is not retried, but the other group and the
            # remaining projects must still go out.
            try:
                send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.PROJECT_REMINDER,
                    level=NotificationLevel.INFO,
                    metadata=_project_reminder_metadata(proj, bounds),
                )
            except Exception:
                logger.exception(
                    "project reminder: dispatch failed for project=%s "
                    "recipients=%d — these recipients get no reminder",
                    proj.id, len(recipient_ids),
                )
                continue
            dispatched += 1
        if dispatched:
            sent += 1
    return sent


def _reminder_groups_by_plan(
    proj: Project, whole_plan: PlanBounds,
) -> list[tuple[list[str], PlanBounds]]:
    """The cast, split into one group per distinct plan.

    A singer who joins on site starts where they are first due and may end
    earlier than the travelling party, and both the reminder's "plan starts"
    row and its calendar attachment say so. Grouped by the plan itself, not by
    the flag: on a plan without travellers-only points both groups resolve to
    the same bounds and one send goes out, as it always did. The recipient rule
    is `NotificationRecipientPolicy`'s, never restated here.
    """
    seats = Participation.objects.filter(project=proj, is_deleted=False)
    on_site_plan = proj.plan_bounds(include_travellers_only=False) or whole_plan
    grouped: dict[PlanBounds, list[str]] = {}
    for joins_on_site, bounds in ((False, whole_plan), (True, on_site_plan)):
        recipients = NotificationRecipientPolicy.from_participations(
            seats.filter(joins_on_site=joins_on_site)
        )
        if recipients:
            grouped.setdefault(bounds, []).extend(recipients)
    return [(recipients, bounds) for bounds, recipients in grouped.items()]


def _project_reminder_metadata(proj: Project, bounds: PlanBounds) -> dict[str, object]:
    """One group's reminder payload. The concert's own moment is the same for
    everyone; the calendar attachment and the "plan starts" facts are the
    group's. The plan's start travels only when it precedes the call, so a
    one-day concert reads exactly as it always has."""
    location_name = proj.location.name if proj.location else ""
    event_time_metadata = build_event_time_metadata(
        proj.date_time,
        proj.timezone,
        fallback_timezone=DEFAULT_EVENT_TIMEZONE,
    )
    calendar_start, calendar_end = proj.calendar_span(bounds)
    return {
        "project_name": proj.title,
        "project_id": str(proj.id),
        # Language-neutral code; every surface names the kind for itself.
        "event_kind": proj.event_kind,
        "date_range": event_time_metadata["starts_at_display"],
        **event_time_metadata,
        "location": location_name,
        "ics": {
            "kind": "project",
            # Carried inside the calendar payload too: the .ics attachment is
            # built from this dict alone, and its subject is the line that
            # ends up in the recipient's own calendar for years.
            "event_kind": proj.event_kind,
            "uid": f"project_{proj.id}@voctensemble.com",
            "start": calendar_start.isoformat(),
            "end": calendar_end.isoformat(),
            "project_name": proj.title,
            "location": location_name,
            "focus": proj.description or "",
        },
        **plan_start_metadata(proj, bounds),
    }


# ──────────────────────────────────────────────────────────────────────────── #
# Unpublished announcement queues                                               #
# The safety net under the announcement queue: batching only pays if somebody    #
# eventually presses send. Hourly beat; each project's own fuse and cooldown are  #
# decided by the queue (see AnnouncementQueue.stale).                             #
# ──────────────────────────────────────────────────────────────────────────── #

@shared_task(name="roster.dispatch_announcement_nudges")
def dispatch_announcement_nudges() -> dict:
    """Tell the managers about queues that have been waiting longer than they should.

    Addressed to every manager rather than to one owner, and that is a consequence
    of a decision taken twice already: nothing records *who* queued a change
    (`queued_by` was deferred in Stage 1 and again in Stage 4), and `conductor` is
    an Artist link, not a permission. Publishing is a manager capability, so an
    unpublished queue is a manager's responsibility — addressing it to the people
    who can actually act on it is the honest reading.

    One nudge per project, not one per manager per day. The queue is per project,
    the fuse is per project, and the action is per project: opening *that* review
    sheet. Folding several projects into one message would buy a smaller inbox at
    the price of the one tap that resolves it.
    """
    # Imported here, not at module scope: services.py pulls in the whole roster
    # service layer, and this module is loaded by every Celery worker at startup.
    from .services import ManagerNotificationHelper

    now = timezone.now()
    stale = AnnouncementQueue.stale(now)
    if not stale:
        return {"nudged": 0}

    nudged: list[str] = []
    for item in stale:
        # Claim before dispatching, and re-state the cooldown as the condition of
        # the write: two beats (or two workers) reading the queue at once would
        # otherwise both pass the check above and both send. The reminder sweep
        # gets away with a flat update because its `due` queryset carries the very
        # predicate the update flips; here the fuse is per project, so the
        # condition has to travel with each row.
        claimed = Project.objects.filter(id=item.project.id).filter(
            Q(announcement_nudged_at__isnull=True)
            | Q(announcement_nudged_at__lte=now - item.fuse)
        ).update(announcement_nudged_at=now)
        if not claimed:
            continue

        metadata = AnnouncementPendingMetadata(
            project_id=item.project.id,
            project_name=item.project.title,
            event_kind=item.project.event_kind,
            change_count=item.change_count,
            recipient_count=item.recipient_count,
            waiting_hours=int((now - item.waiting_since).total_seconds() // 3600),
        ).model_dump(mode="json")

        ManagerNotificationHelper.notify_managers(
            notification_type=NotificationType.ANNOUNCEMENT_PENDING,
            metadata=metadata,
            level=item.level,
        )
        nudged.append(str(item.project.id))

    if nudged:
        logger.info(
            "[AnnouncementNudge] %d project queue(s) waiting past their fuse: %s",
            len(nudged),
            ", ".join(nudged),
        )
    return {"nudged": len(nudged)}


@shared_task(name="roster.dispatch_due_reminders")
def dispatch_due_reminders() -> dict:
    """Hourly beat entry: fan out reminders for rehearsals/concerts entering their lead window."""
    now = timezone.now()
    rehearsals = _dispatch_rehearsal_reminders(now)
    projects = _dispatch_project_reminders(now)
    if rehearsals or projects:
        logger.info(
            "[Reminders] Dispatched %d rehearsal + %d project reminder(s).", rehearsals, projects
        )
    return {"rehearsals": rehearsals, "projects": projects}


# ──────────────────────────────────────────────────────────────────────────── #
# Material notices                                                              #
# Every uploaded track and every approved edition fires the material event, so  #
# a batch of rehearsal MP3s would be a dozen pushes per singer — the quickest   #
# way to teach members to switch push off. The roster listener opens a window   #
# per piece on the first event; this task closes it with one notice.            #
#                                                                               #
# Two keys, because only `cache.add` may create the gate: a listener that       #
# re-wrote it with `set` just as the task deleted it would leave a gate with no #
# task behind it, and every upload to that piece would go unannounced until it  #
# expired. The kinds key may be re-written freely — at worst it mislabels.      #
# ──────────────────────────────────────────────────────────────────────────── #

# The keys outlive the window by this much, so a task a busy worker picks up
# late still finds the kinds recorded for it.
_MATERIAL_NOTICE_KEY_MARGIN_SECONDS = 5 * 60


def material_notice_window_seconds() -> int:
    return int(getattr(settings, "MATERIAL_NOTICE_WINDOW_SECONDS", 10 * 60))


def material_notice_key_timeout() -> int:
    return material_notice_window_seconds() + _MATERIAL_NOTICE_KEY_MARGIN_SECONDS


def material_notice_gate_key(piece_id: str) -> str:
    return f"material-notice:{piece_id}"


def material_notice_kinds_key(piece_id: str) -> str:
    return f"material-notice:{piece_id}:kinds"


@shared_task(name="roster.dispatch_material_notice")
def dispatch_material_notice_task(piece_id: str) -> int:
    """
    Closes a piece's material window: one notice for everything that landed in it.

    Recipients are resolved now, not when the first file arrived, so a singer cast
    during the window hears about it and one who left does not. The kind is named
    only when every event agreed; a mixed or unknown window sends `None`, whose
    generic wording the composer already has.
    """
    # Reopen first: an upload from here on starts its own window rather than
    # being folded into a notice that has already been composed.
    cache.delete(material_notice_gate_key(piece_id))
    kinds: list[str] = cache.get(material_notice_kinds_key(piece_id)) or []
    cache.delete(material_notice_kinds_key(piece_id))

    piece = Piece.objects.select_related("composer").filter(id=piece_id).first()
    if piece is None:
        return 0

    user_ids = Participation.objects.filter(
        project__program_items__piece=piece,
        is_deleted=False,
        project__is_deleted=False,
    ).values_list("artist__user_id", flat=True).distinct()
    recipient_ids = [str(uid) for uid in user_ids if uid]
    if not recipient_ids:
        return 0

    distinct_kinds = set(kinds)
    material_kind = (distinct_kinds.pop() or None) if len(distinct_kinds) == 1 else None

    send_bulk_notifications_task.delay(
        recipient_ids=recipient_ids,
        notification_type=NotificationType.MATERIAL_UPLOADED,
        level=NotificationLevel.INFO,
        metadata={
            "piece_id": str(piece.id),
            "piece_title": piece.title,
            "material_kind": material_kind,
            "composer_name": str(piece.composer) if piece.composer_id else None,
        },
    )
    logger.info(
        "[MaterialNotice] One notice for %d event(s) on piece '%s' to %d user(s).",
        len(kinds), piece.title, len(recipient_ids),
    )
    return len(recipient_ids)
