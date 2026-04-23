from typing import Dict, Any
from .models import NotificationPreference, NotificationType
from .email_tasks import send_transactional_email_task
from .tasks import send_push_notification_task

class NotificationRouter:
    """
    Orchestrates multi-channel delivery based on granular user preferences.
    """

    @classmethod
    def route(cls, recipient_id: str, notification_type: str, metadata: Dict[str, Any]) -> None:
        """
        Evaluates preferences and triggers specific channel tasks.
        """
        pref, _ = NotificationPreference.objects.get_or_create(
            user_id=recipient_id,
            notification_type=notification_type
        )

        # 1. Email Channel
        if pref.email_enabled:
            send_transactional_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                template_name="system_notification",
                metadata=metadata
            )

        # 2. Push Channel
        if pref.push_enabled:
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                metadata=metadata
            )