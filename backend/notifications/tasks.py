# notifications/tasks.py
from celery import shared_task
from typing import Dict, Any, Optional, List
from .services import NotificationService
from .models import NotificationLevel
from .dtos import NotificationCreateDTO

@shared_task(
    name="notifications.send_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=5
)
def send_notification_task(
    self, 
    recipient_id: str, 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Background worker task to provision a notification asynchronously.
    """
    try:
        # Enterprise Pattern: Rehydrate and validate DTO inside the worker.
        # This guarantees that data passing through Redis queue is strictly validated 
        # before any business logic is executed.
        dto = NotificationCreateDTO(
            recipient_id=recipient_id,
            notification_type=notification_type,
            level=level,
            metadata=metadata or {}
        )
        NotificationService.create_notification(dto=dto)
    except Exception as exc:
        raise self.retry(exc=exc)

@shared_task(name="notifications.send_bulk_notifications")
def send_bulk_notifications_task(
    recipient_ids: List[str], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Optimized fan-out worker task for broadcasting the same notification to multiple users.
    """
    for recipient_id in recipient_ids:
        send_notification_task.delay(recipient_id, notification_type, level, metadata)