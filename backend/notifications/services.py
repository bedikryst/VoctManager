# notifications/services.py
import logging
from typing import Optional
from django.db import transaction
from django.contrib.auth import get_user_model

from .models import Notification
from .dtos import NotificationCreateDTO
from .email_tasks import send_transactional_email_task

logger = logging.getLogger(__name__)
User = get_user_model()

class NotificationService:
    @classmethod
    def create_notification(cls, dto: NotificationCreateDTO) -> Optional[Notification]:
        try:
            with transaction.atomic():
                notification = Notification.objects.create(
                    recipient_id=dto.recipient_id,
                    notification_type=dto.notification_type,
                    level=dto.level,
                    metadata=dto.metadata if isinstance(dto.metadata, dict) else dto.metadata.model_dump()
                )
            
                # --- ENTERPRISE EVENT DISPATCH (Operational Emails) ---
                # 1. Fetch user and their specific profile preferences via SQL JOIN
                user = User.objects.select_related('profile').get(id=dto.recipient_id)
                
                # 2. Evaluate business rules
                if user.profile.email_notifications_enabled:
                    # 3. Dispatch background email task ONLY if transaction completes successfully
                    subject = cls._generate_subject_for_type(dto.notification_type, user.profile.language)
                    transaction.on_commit(lambda: send_transactional_email_task.delay(
                        recipient_email=user.email,
                        subject=cls._generate_subject_for_type(dto.notification_type),
                        template_name="system_notification",
                        context={
                            "first_name": getattr(user, 'first_name', ''),
                            "notification_type": dto.notification_type,
                            "metadata": notification.metadata
                        },
                        language_code=user.profile.language
                    ))
            
            logger.info(f"In-app notification [{dto.notification_type}] created for user {dto.recipient_id}")
            return notification
            
        except Exception as e:
            logger.error(f"Failed to create notification for {dto.recipient_id}. Error: {str(e)}", exc_info=True)
            return None

    @staticmethod
    def _generate_subject_for_type(notification_type: str) -> str:
        """Translates system ENUMs into human-readable email subjects."""
        mapping = {
            'PROJECT_INVITATION': 'You have a new project invitation',
            'REHEARSAL_SCHEDULED': 'New Rehearsal Scheduled',
            'REHEARSAL_UPDATED': 'Rehearsal Schedule Changed',
            'MATERIAL_UPLOADED': 'New Sheet Music Available',
            'PIECE_CASTING_ASSIGNED': 'You have been cast in a new piece',
        }
        return mapping.get(notification_type, "New update from VoctManager")