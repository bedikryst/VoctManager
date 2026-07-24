"""
===============================================================================
Enterprise Notification Background Workers
===============================================================================
Domain: Notifications
Description: 
    Celery task definitions for asynchronous notification dispatching.
    Implements advanced Celery patterns including Group Dispatching (Fan-Out)
    and robust error handling with exponential backoff.

Standards: SaaS 2026, Scalable Fan-Out, Strict Payload Rehydration.
===============================================================================
"""

import logging
from datetime import timedelta
from typing import Any
from zoneinfo import ZoneInfo

from celery import group, shared_task
from django.conf import settings
from django.utils import timezone

from core.greetings import apply_vocative_rule

from .dtos import NotificationCreateDTO
from .models import NotificationLevel, NotificationType
from .services import NotificationService

logger = logging.getLogger(__name__)

_DEFAULT_DIGEST_TZ = "Europe/Warsaw"


# --- 1. CORE NOTIFICATION PROVISIONING ---

@shared_task(
    name="notifications.send_notification",
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_jitter=True
)
def send_notification_task(
    self, 
    recipient_id: int | str,
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: dict[str, Any] | None = None
) -> None:
    """
    Entry boundary. Rehydrates payloads into strictly validated DTOs and delegates to service.
    (This remains largely unchanged, as NotificationService.create_notification will now call the router via on_commit).
    """
    try:
        dto = NotificationCreateDTO(
            recipient_id=recipient_id,
            notification_type=notification_type,
            level=level,
            metadata=metadata or {}
        )
        NotificationService.create_notification(dto=dto)
    except Exception as exc:
        logger.error(f"[Task] send_notification failed for UID:{recipient_id}. Retrying... Reason: {exc}")
        raise self.retry(exc=exc)

# --- 2. MULTI-CHANNEL ROUTING ---

@shared_task(name="notifications.route_notification")
def route_notification_task(
    recipient_id: str,
    notification_type: str,
    metadata: dict[str, Any],
    level: str = NotificationLevel.INFO,
) -> None:
    """
    Evaluates DB preferences and dynamically spawns isolated transport tasks.
    Invoked strictly after Notification DB transaction commits.
    """
    from .router import NotificationRouter
    NotificationRouter.route(
        recipient_id=recipient_id,
        notification_type=notification_type,
        metadata=metadata,
        level=level,
    )

# --- 3. PUSH TRANSPORT ---

@shared_task(
    name="notifications.send_push_notification",
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_jitter=True
)
def send_push_notification_task(
    self,
    recipient_id: str,
    notification_type: str,
    metadata: dict[str, Any],
    level: str = NotificationLevel.INFO,
) -> None:
    """
    Isolated transport task for VAPID + FCM dispatch. Delegates payload
    composition to the dispatcher service; transient transport failures are
    retried with exponential backoff.
    """
    try:
        from .push_service import PushDispatcherService
        PushDispatcherService.dispatch_to_user(
            recipient_id=recipient_id,
            notification_type=notification_type,
            metadata=metadata,
            level=level,
        )
    except Exception as exc:
        logger.error(f"[Task] Push transport failed for UID:{recipient_id}. Retrying... Reason: {exc}")
        raise self.retry(exc=exc)

# --- 4. FAN-OUT ORCHESTRATION ---

@shared_task(name="notifications.send_bulk_notifications")
def send_bulk_notifications_task(
    recipient_ids: list[int | str], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: dict[str, Any] | None = None
) -> None:
    """
    Optimized Fan-Out orchestrator for broadcast events.
    Maintains compatibility with the new routing flow automatically because it delegates
    to send_notification_task, which triggers the DB transaction and subsequent routing.
    """
    if not recipient_ids:
        logger.warning("[Task] send_bulk_notifications invoked with an empty recipient list. Aborting.")
        return

    logger.info(f"[Task] Orchestrating bulk dispatch of [{notification_type}] to {len(recipient_ids)} users.")

    signatures = [
        send_notification_task.s(
            recipient_id=uid, 
            notification_type=notification_type, 
            level=level, 
            metadata=metadata
        )
        for uid in recipient_ids
    ]
    
    job = group(signatures)
    job.apply_async()


# --- 5. DAILY DIGEST -------------------------------------------------------- #
# Routine INFO manager alerts are held back from real-time channels by the router
# and collected here into one human, scannable email per recipient per day — sent
# at the recipient's chosen local hour, and only when there is something to say.

# Digest sections, in descending order of how much they demand the conductor's
# attention. Titles are resolved lazily inside the language override.
_DIGEST_SECTIONS: tuple[str, ...] = (
    NotificationType.ABSENCE_REQUESTED,
    NotificationType.PARTICIPATION_RESPONSE,
    NotificationType.ATTENDANCE_SUBMITTED,
)


def _digest_section_title(notification_type: str) -> str:
    from django.utils.translation import gettext as _
    titles: dict[str, str] = {
        NotificationType.ABSENCE_REQUESTED: _("Absence requests"),
        NotificationType.PARTICIPATION_RESPONSE: _("Participation responses"),
        NotificationType.ATTENDANCE_SUBMITTED: _("Attendance updates"),
    }
    return titles.get(notification_type, _("Updates"))


def _digest_detail(notification) -> str:
    """A localized one-line detail for a digest row, rendered from structured
    metadata (status codes) — never from stored prose."""
    from .message_content import (
        _attendance_status_phrase,
        _participation_status_phrase,
    )

    m = notification.metadata or {}
    ntype = notification.notification_type
    if ntype == NotificationType.PARTICIPATION_RESPONSE:
        return _participation_status_phrase(m.get("status"))
    if ntype == NotificationType.ATTENDANCE_SUBMITTED:
        return _attendance_status_phrase(m.get("status"))
    if ntype == NotificationType.ABSENCE_REQUESTED:
        return m.get("rehearsal_date") or m.get("excuse_note") or ""
    return m.get("rehearsal_date") or ""


def _dispatch_digest(profile, notifications: list) -> None:
    """Renders and sends one grouped digest email in the recipient's language."""
    from django.utils import translation

    from .email_service import EmailDispatcherService, EmailType

    user = profile.user
    lang = getattr(profile, "language", "en") or "en"

    with translation.override(lang):
        groups: list[dict[str, Any]] = []
        for ntype in _DIGEST_SECTIONS:
            items = [
                {
                    "primary": (n.metadata or {}).get("artist_name") or "",
                    "secondary": (n.metadata or {}).get("project_name") or "",
                    "detail": _digest_detail(n),
                }
                for n in notifications
                if n.notification_type == ntype
            ]
            if items:
                groups.append({"title": _digest_section_title(ntype), "count": len(items), "items": items})

        total = sum(g["count"] for g in groups)
        frontend_url = getattr(settings, "FRONTEND_URL", "https://voctensemble.com")

        # Read off the profile already in hand rather than back through the user,
        # so the digest fan-out stays at one query per recipient.
        first_name_vocative = apply_vocative_rule(
            vocative=getattr(profile, "first_name_vocative", "") or "",
            first_name=user.first_name,
            language=lang,
        )

        from django.utils.translation import ngettext
        # Plural-correct in every language — Polish alone needs three forms
        # (1 / 2-4 / 5+), which a single "%(count)d update(s)" string cannot carry.
        subject = ngettext(
            "Your daily briefing — %(count)d update",
            "Your daily briefing — %(count)d updates",
            total,
        ) % {"count": total}

        context = {
            "first_name": user.first_name,
            "first_name_vocative": first_name_vocative,
            "groups": groups,
            "total": total,
            "lang": lang,
            "site_url": getattr(settings, "SITE_URL", f"{frontend_url}/panel"),
            "manage_prefs_url": f"{frontend_url}/panel/settings?tab=notifications",
        }
        EmailDispatcherService.dispatch(
            recipient_email=user.email,
            subject=subject,
            template_name="digest",
            context=context,
            fallback_language=lang,
            email_type=EmailType.OPERATIONAL,
        )


@shared_task(name="notifications.send_notification_digests")
def send_notification_digests() -> dict:
    """
    Hourly beat. For each recipient whose local hour matches their digest_hour and
    who hasn't been digested in the last ~23h, collect the routine INFO manager
    alerts from the trailing window and send one grouped email. Silent when empty.
    """
    from core.models import UserProfile

    from .delivery import DIGESTIBLE_TYPES
    from .models import Notification, NotificationPreference

    now = timezone.now()
    sent = 0

    profiles = (
        UserProfile.objects.filter(
            digest_enabled=True,
            email_notifications_enabled=True,
            email_undeliverable=False,
            user__is_active=True,
        )
        .select_related("user")
    )
    for profile in profiles:
        try:
            tz = ZoneInfo(profile.timezone or _DEFAULT_DIGEST_TZ)
        except Exception:
            tz = ZoneInfo(_DEFAULT_DIGEST_TZ)

        if now.astimezone(tz).hour != profile.digest_hour:
            continue
        if profile.last_digest_sent_at and profile.last_digest_sent_at > now - timedelta(hours=23):
            continue
        if not getattr(profile.user, "email", None):
            continue

        floor = now - timedelta(hours=26)
        since = (
            profile.last_digest_sent_at
            if profile.last_digest_sent_at and profile.last_digest_sent_at > floor
            else floor
        )

        notifications = list(
            Notification.objects.filter(
                recipient_id=profile.user_id,
                notification_type__in=DIGESTIBLE_TYPES,
                level=NotificationLevel.INFO,
                created_at__gt=since,
                created_at__lte=now,
            ).order_by("created_at")
        )
        if not notifications:
            continue

        disabled = set(
            NotificationPreference.objects.filter(
                user_id=profile.user_id, email_enabled=False
            ).values_list("notification_type", flat=True)
        )
        notifications = [n for n in notifications if n.notification_type not in disabled]
        if not notifications:
            continue

        try:
            _dispatch_digest(profile, notifications)
            UserProfile.objects.filter(pk=profile.pk).update(last_digest_sent_at=now)
            sent += 1
        except Exception:
            logger.error("[Digest] Failed for UID:%s", profile.user_id, exc_info=True)

    if sent:
        logger.info("[Digest] Dispatched %d digest email(s).", sent)
    return {"sent": sent}