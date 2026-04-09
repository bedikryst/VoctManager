# notifications/services.py
# ==========================================
# Notifications Business Logic (Domain Services)
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from typing import Dict, Any, Optional
from django.db import transaction
from .models import Notification, NotificationType, NotificationLevel

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Enterprise service for handling all notification-related business logic.
    Ensures data integrity and acts as the single source of truth for in-app alert creation.
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
        Creates a single notification safely and prepares for real-time hooks.
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
            
            logger.info(f"In-app notification [{notification_type}] created for user {recipient_id}")
            
            # FUTURE ENTERPRISE HOOK:
            # transaction.on_commit(lambda: realtime_dispatcher.send(recipient_id, serialized_notification))
            
            return notification
        except Exception as e:
            logger.error(f"Failed to create notification for {recipient_id}. Error: {str(e)}", exc_info=True)
            return None