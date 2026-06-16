"""
@file router.py
@description Multi-channel delivery orchestrator. Reads granular per-type
             user preferences and fans the notification out to the email and
             push transport tasks. Pure routing — no template logic.
@architecture Enterprise SaaS 2026
@module notifications/router
"""
from typing import Any

from .delivery import is_digestible
from .email_tasks import send_notification_email_task
from .models import NotificationLevel, NotificationPreference, NotificationType
from .tasks import send_push_notification_task

# Per-type override map. Falls back to the structured `transactional` template
# (fed by the message_content layer) for everything else.
_EMAIL_TEMPLATE_MAP: dict[str, str] = {
    NotificationType.CUSTOM_ADMIN_MESSAGE: "custom_admin_message",
    NotificationType.MESSAGE_RECEIVED: "message_received",
}


class NotificationRouter:
    """Evaluates user preferences and dispatches to isolated transport tasks."""

    @classmethod
    def route(
        cls,
        recipient_id: str,
        notification_type: str,
        metadata: dict[str, Any],
        level: str = NotificationLevel.INFO,
    ) -> None:
        """
        NOTIFICATION_READ_RECEIPT is in-app only — no email or push by design.
        Routine INFO manager alerts are held back from real-time channels when the
        recipient has the daily digest enabled; the in-app row is already persisted
        and the digest sweep collects it. Disabling the digest restores immediate
        email + push for these events.
        """
        if notification_type == NotificationType.NOTIFICATION_READ_RECEIPT:
            return

        if is_digestible(notification_type, level) and cls._digest_enabled(recipient_id):
            return

        pref, _ = NotificationPreference.objects.get_or_create(
            user_id=recipient_id,
            notification_type=notification_type,
        )

        template_name = _EMAIL_TEMPLATE_MAP.get(notification_type, "transactional")

        if pref.email_enabled:
            send_notification_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                template_name=template_name,
                metadata=metadata,
                level=level,
            )

        if pref.push_enabled:
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                metadata=metadata,
                level=level,
            )

    @staticmethod
    def _digest_enabled(recipient_id: str) -> bool:
        """Whether the recipient batches routine alerts into the daily digest."""
        from core.models import UserProfile
        return UserProfile.objects.filter(
            user_id=recipient_id, digest_enabled=True
        ).exists()
