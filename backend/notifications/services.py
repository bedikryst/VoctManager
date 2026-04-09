# notifications/services.py
import logging
from typing import Dict, Any, Optional
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Notification, NotificationType, NotificationLevel

logger = logging.getLogger(__name__)
User = get_user_model()

class NotificationService:
    """
    Enterprise service for handling all notification-related business logic.
    Ensures data integrity and acts as the single source of truth for notification creation.
    """

    @classmethod
    def create_notification(
        cls, 
        recipient_id: str, 
        notification_type: str, 
        level: str = NotificationLevel.INFO, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Notification]:
        """
        Creates a single notification safely.
        """
        if metadata is None:
            metadata = {}

        try:
            with transaction.atomic():
                notification = Notification.objects.create(
                    recipient_id=recipient_id,
                    notification_type=notification_type,
                    level=level,
                    metadata=metadata
                )
            logger.info(f"Notification created for user {recipient_id}: {notification_type}")
            
            # FUTURE HOOK: Here we will trigger WebSockets/SSE in Phase 2
            # e.g., realtime_dispatcher.send(recipient_id, serialized_notification)
            
            return notification
        except Exception as e:
            logger.error(f"Failed to create notification for {recipient_id}. Error: {str(e)}", exc_info=True)
            return None