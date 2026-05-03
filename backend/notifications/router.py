"""
@file router.py
@description Multi-channel delivery orchestrator. Reads granular per-type
             user preferences and fans the notification out to the email and
             push transport tasks. Pure routing — no template logic.
@architecture Enterprise SaaS 2026
@module notifications/router
"""
from typing import Any, Dict

from .email_tasks import send_notification_email_task
from .models import NotificationLevel, NotificationPreference, NotificationType
from .tasks import send_push_notification_task

# Per-type override map. Falls back to system_notification for everything else.
_EMAIL_TEMPLATE_MAP: Dict[str, str] = {
    NotificationType.CUSTOM_ADMIN_MESSAGE: "custom_admin_message",
}


class NotificationRouter:
    """Evaluates user preferences and dispatches to isolated transport tasks."""

    @classmethod
    def route(
        cls,
        recipient_id: str,
        notification_type: str,
        metadata: Dict[str, Any],
        level: str = NotificationLevel.INFO,
    ) -> None:
        """
        NOTIFICATION_READ_RECEIPT is in-app only — no email or push by design.
        """
        if notification_type == NotificationType.NOTIFICATION_READ_RECEIPT:
            return

        pref, _ = NotificationPreference.objects.get_or_create(
            user_id=recipient_id,
            notification_type=notification_type,
        )

        template_name = _EMAIL_TEMPLATE_MAP.get(notification_type, "system_notification")

        if pref.email_enabled:
            send_notification_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                template_name=template_name,
                metadata=metadata,
            )

        if pref.push_enabled:
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                metadata=metadata,
                level=level,
            )
