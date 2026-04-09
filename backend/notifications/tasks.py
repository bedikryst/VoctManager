# notifications/tasks.py
from celery import shared_task
from typing import Dict, Any, Optional, List
from .services import NotificationService
from .models import NotificationLevel

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
    Includes built-in retry mechanisms for transient database locks.
    """
    try:
        NotificationService.create_notification(
            recipient_id=recipient_id,
            notification_type=notification_type,
            level=level,
            metadata=metadata
        )
    except Exception as exc:
        # Enterprise-grade retry logic for transient failures
        raise self.retry(exc=exc)

@shared_task(name="notifications.send_bulk_notifications")
def send_bulk_notifications_task(
    recipient_ids: List[str], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Optimized worker task for broadcasting the same notification to multiple users 
    (e.g., all choir members assigned to a newly scheduled rehearsal).
    """
    for recipient_id in recipient_ids:
        # We delegate to the single task to distribute the load across Celery workers
        send_notification_task.delay(recipient_id, notification_type, level, metadata)