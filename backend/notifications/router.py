from typing import Dict, Any
from .models import NotificationPreference, NotificationType
from .email_tasks import send_notification_email_task
from .tasks import send_push_notification_task

# Maps notification types to dedicated email templates.
# Falls back to system_notification for all unspecified types.
_EMAIL_TEMPLATE_MAP: Dict[str, str] = {
    NotificationType.CUSTOM_ADMIN_MESSAGE: "custom_admin_message",
}


class NotificationRouter:
    """
    Orchestrates multi-channel delivery based on granular user preferences.
    """

    @classmethod
    def route(cls, recipient_id: str, notification_type: str, metadata: Dict[str, Any]) -> None:
        """
        Evaluates preferences and triggers specific channel tasks.
        NOTIFICATION_READ_RECEIPT is in-app only — no email or push by design.
        """
        if notification_type == NotificationType.NOTIFICATION_READ_RECEIPT:
            return

        pref, _ = NotificationPreference.objects.get_or_create(
            user_id=recipient_id,
            notification_type=notification_type
        )

        template_name = _EMAIL_TEMPLATE_MAP.get(notification_type, "system_notification")

        # 1. Email Channel
        if pref.email_enabled:
            send_notification_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                template_name=template_name,
                metadata=metadata
            )

        # 2. Push Channel
        if pref.push_enabled:
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                metadata=metadata
            )