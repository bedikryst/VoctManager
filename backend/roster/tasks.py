# roster/tasks.py
"""
Asynchronous background tasks for the Roster application.
Utilizes Celery and Redis to handle resource-intensive operations.
"""

import io
import logging
import zipfile
from datetime import timedelta
from zoneinfo import ZoneInfo

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone

from notifications.models import NotificationLevel, NotificationType
from notifications.services import NotificationRecipientPolicy
from notifications.tasks import send_bulk_notifications_task

from .infrastructure.document_generator import DocumentGenerator
from .models import (
    DEFAULT_EVENT_TIMEZONE,
    CrewAssignment,
    Participation,
    Project,
    Rehearsal,
)

logger = logging.getLogger(__name__)

# Duration assumptions for the calendar attachment when no explicit end exists.
_REHEARSAL_DURATION = timedelta(hours=3)
_CONCERT_DURATION = timedelta(hours=4)


def _safe_segment(value: str) -> str:
    """Filesystem-safe filename fragment."""
    return value.replace(' ', '_').replace('/', '-').replace('\\', '-')


@shared_task(bind=True)
def generate_project_zip_task(self, project_id):
    """
    Generates PDF contracts for every cast member AND crew collaborator on a
    project, packages them into an in-memory ZIP archive, and saves the file to
    default storage. Returns the download URL upon completion.

    PDF rendering is delegated to ``DocumentGenerator`` so the binary artifacts
    match the single-contract endpoint exactly (the legacy inline render passed
    the wrong template context and produced blank contracts). WeasyPrint is
    imported lazily inside the generator, so this module stays importable on
    hosts without the native rendering libraries.
    """
    participations = (
        Participation.objects
        .filter(project_id=project_id, is_deleted=False)
        .select_related('artist', 'project')
        .order_by('artist__last_name')
    )
    crew = (
        CrewAssignment.objects
        .filter(project_id=project_id)
        .select_related('collaborator', 'project')
        .order_by('collaborator__last_name')
    )

    project = None
    first_participation = participations.first()
    if first_participation is not None:
        project = first_participation.project
    else:
        first_crew = crew.first()
        if first_crew is not None:
            project = first_crew.project

    if project is None:
        return {"error": "no_personnel_in_project"}

    safe_title = _safe_segment(project.title)
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for participation in participations:
            pdf_bytes = DocumentGenerator.generate_participation_contract_pdf(participation)
            artist = participation.artist
            safe_name = _safe_segment(f"{artist.last_name}_{artist.first_name}")
            zip_file.writestr(f"Umowa-{safe_title}-{safe_name}.pdf", pdf_bytes)

        for assignment in crew:
            pdf_bytes = DocumentGenerator.generate_crew_contract_pdf(assignment)
            collaborator = assignment.collaborator
            safe_name = _safe_segment(f"{collaborator.last_name}_{collaborator.first_name}")
            zip_file.writestr(f"Umowa-{safe_title}-EKIPA-{safe_name}.pdf", pdf_bytes)

    zip_buffer.seek(0)
    file_path = f"exports/Contracts_Project_{safe_title}.zip"

    # Cleanup previous generation to save storage space
    if default_storage.exists(file_path):
        default_storage.delete(file_path)

    saved_path = default_storage.save(file_path, ContentFile(zip_buffer.read()))

    return {
        "download_url": default_storage.url(saved_path),
        "message": "success",
    }


# ──────────────────────────────────────────────────────────────────────────── #
# Upcoming-event reminders                                                      #
# Hourly beat sweep. Each rehearsal/project is reminded once, when it first      #
# enters its lead window; `reminder_sent_at` is claimed atomically so a second   #
# beat (or worker) cannot double-send.                                           #
# ──────────────────────────────────────────────────────────────────────────── #

def _fmt_local(dt, tz_name: str) -> str:
    """Human, language-neutral local time for the reminder body (DD.MM.YYYY, HH:MM)."""
    try:
        local = dt.astimezone(ZoneInfo(tz_name or DEFAULT_EVENT_TIMEZONE))
    except Exception:
        local = dt
    return local.strftime("%d.%m.%Y, %H:%M")


def _dispatch_rehearsal_reminders(now) -> int:
    lead = timedelta(hours=getattr(settings, "REHEARSAL_REMINDER_LEAD_HOURS", 24))
    due = (
        Rehearsal.objects.filter(
            is_deleted=False,
            reminder_sent_at__isnull=True,
            date_time__gt=now,
            date_time__lte=now + lead,
        )
        .exclude(project__status=Project.Status.CANCELLED)
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
        .prefetch_related("invited_participations")
    )
    for reh in rehearsals:
        participations = reh.invited_participations.all()
        if not participations.exists():
            participations = Participation.objects.filter(project=reh.project, is_deleted=False)

        recipient_ids = NotificationRecipientPolicy.from_participations(participations)
        if not recipient_ids:
            continue

        location_name = reh.location.name if reh.location else ""
        metadata = {
            "project_name": reh.project.title,
            "project_id": str(reh.project_id),
            "rehearsal_id": str(reh.id),
            "starts_at": _fmt_local(reh.date_time, reh.timezone),
            "location": location_name,
            "ics": {
                "kind": "rehearsal",
                "uid": f"rehearsal_{reh.id}@voctensemble.com",
                "start": reh.date_time.isoformat(),
                "end": (reh.date_time + _REHEARSAL_DURATION).isoformat(),
                "project_name": reh.project.title,
                "location": location_name,
                "focus": reh.focus or "",
            },
        }
        send_bulk_notifications_task.delay(
            recipient_ids=recipient_ids,
            notification_type=NotificationType.REHEARSAL_REMINDER,
            level=NotificationLevel.INFO,
            metadata=metadata,
        )
        sent += 1
    return sent


def _dispatch_project_reminders(now) -> int:
    lead = timedelta(hours=getattr(settings, "PROJECT_REMINDER_LEAD_HOURS", 48))
    due = Project.objects.filter(
        is_deleted=False,
        reminder_sent_at__isnull=True,
        date_time__gt=now,
        date_time__lte=now + lead,
        status__in=[Project.Status.DRAFT, Project.Status.ACTIVE],
    )
    ids = list(due.values_list("id", flat=True))
    if not ids:
        return 0

    Project.objects.filter(id__in=ids).update(reminder_sent_at=now)

    sent = 0
    for proj in Project.objects.filter(id__in=ids).select_related("location"):
        participations = Participation.objects.filter(project=proj, is_deleted=False)
        recipient_ids = NotificationRecipientPolicy.from_participations(participations)
        if not recipient_ids:
            continue

        location_name = proj.location.name if proj.location else ""
        start = proj.call_time or proj.date_time
        metadata = {
            "project_name": proj.title,
            "project_id": str(proj.id),
            "date_range": _fmt_local(proj.date_time, proj.timezone),
            "location": location_name,
            "ics": {
                "kind": "project",
                "uid": f"project_{proj.id}@voctensemble.com",
                "start": start.isoformat(),
                "end": (proj.date_time + _CONCERT_DURATION).isoformat(),
                "project_name": proj.title,
                "location": location_name,
                "focus": proj.description or "",
            },
        }
        send_bulk_notifications_task.delay(
            recipient_ids=recipient_ids,
            notification_type=NotificationType.PROJECT_REMINDER,
            level=NotificationLevel.INFO,
            metadata=metadata,
        )
        sent += 1
    return sent


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
