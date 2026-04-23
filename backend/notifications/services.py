# notifications/services.py
"""
===============================================================================
Enterprise Notification Service
===============================================================================
Domain: Notifications
Description: 
    Core domain service responsible for provisioning in-app notifications.
    Adheres strictly to the Event-Driven Architecture (EDA) paradigm by 
    decoupling primary domain logic from downstream asynchronous side-effects 
    (like email dispatch) via transactional outbox or on_commit hooks.

Standards: SaaS 2026, ACID Compliant, Zero-State Leakage, Celery Safe-Serialization.
===============================================================================
"""

import logging
from typing import Optional
from django.db import transaction

from .dtos import NotificationCreateDTO, NotificationPreferenceUpdateDTO
from .models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Orchestrates the lifecycle of in-app notifications and triggers downstream events.
    """

    @classmethod
    def create_notification(cls, dto: NotificationCreateDTO) -> Optional[Notification]:
        """
        Provisions a new notification entity synchronously and registers 
        asynchronous side-effects (e.g., operational emails) upon transaction commit.
        """
        try:
            with transaction.atomic():
                metadata_payload = dto.metadata if isinstance(dto.metadata, dict) else dto.metadata.model_dump(mode="json")
                
                # Provision the In-App Notification
                notification = Notification.objects.create(
                    recipient_id=dto.recipient_id,
                    notification_type=dto.notification_type,
                    level=dto.level,
                    metadata=metadata_payload
                )
            
                def dispatch_task():
                    from .tasks import route_notification_task
                    route_notification_task.delay(
                        recipient_id=str(dto.recipient_id), 
                        notification_type=dto.notification_type,
                        metadata=notification.metadata
                    )

                transaction.on_commit(dispatch_task)
            
            logger.info(f"[NotificationService] Provisioned [{dto.notification_type}] for UID:{dto.recipient_id}")
            return notification
            
        except Exception as e:
            # Catch-all for database integrity errors or serialization failures
            logger.error(f"[NotificationService] Provisioning failed for UID:{dto.recipient_id}. Reason: {e}", exc_info=True)
            return None
        
class NotificationPreferenceService:
    """
    Service layer for managing user delivery channel preferences.
    """

    @classmethod
    def update_preferences(cls, dto: NotificationPreferenceUpdateDTO) -> NotificationPreference:
        """
        Updates or creates granular notification channel preferences for a user.
        """
        preference, created = NotificationPreference.objects.update_or_create(
            user_id=dto.user_id,
            notification_type=dto.notification_type,
            defaults={
                k: v for k, v in [
                    ('email_enabled', dto.email_enabled),
                    ('push_enabled', dto.push_enabled),
                    ('sms_enabled', dto.sms_enabled)
                ] if v is not None
            }
        )
        
        logger.info(
            f"[NotificationPreferenceService] Updated preferences for UID:{dto.user_id}, "
            f"Type:{dto.notification_type}"
        )
        return preference