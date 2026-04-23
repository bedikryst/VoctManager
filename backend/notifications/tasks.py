"""
===============================================================================
Enterprise Notification Background Workers
===============================================================================
Domain: Notifications
Description: 
    Celery task definitions for asynchronous notification dispatching.
    Implements advanced Celery patterns including Group Dispatching (Fan-Out)
    and robust error handling with exponential backoff.

Standards: SaaS 2026, Scalable Fan-Out, Strict Payload Rehydration.
===============================================================================
"""

import logging
from typing import Dict, Any, Optional, List, Union
from uuid import UUID
from celery import shared_task, group

from .services import NotificationService
from .dtos import NotificationCreateDTO
from .models import NotificationLevel

logger = logging.getLogger(__name__)


@shared_task(
    name="notifications.send_notification",
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_jitter=True
)
def send_notification_task(
    self, 
    recipient_id: Union[int, str, UUID], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Background worker that acts as the entry boundary for the Notification domain.
    Rehydrates primitive queue payloads into strictly validated DTOs before 
    delegating to the domain service.
    """
    try:
        dto = NotificationCreateDTO(
            recipient_id=recipient_id,
            notification_type=notification_type,
            level=level,
            metadata=metadata or {}
        )
        
        NotificationService.create_notification(dto=dto)
        
    except Exception as exc:
        logger.error(f"[Task] send_notification failed for UID:{recipient_id}. Retrying... Reason: {exc}")
        raise self.retry(exc=exc)


@shared_task(name="notifications.send_bulk_notifications")
def send_bulk_notifications_task(
    recipient_ids: List[Union[int, str, UUID]], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Highly optimized Fan-Out orchestrator for broadcast events (e.g., full choir updates).
    """
    if not recipient_ids:
        logger.warning("[Task] send_bulk_notifications invoked with an empty recipient list. Aborting.")
        return

    logger.info(f"[Task] Orchestrating bulk dispatch of [{notification_type}] to {len(recipient_ids)} users.")

    signatures = [
        send_notification_task.s(
            recipient_id=uid, 
            notification_type=notification_type, 
            level=level, 
            metadata=metadata
        )
        for uid in recipient_ids
    ]
    
    job = group(signatures)
    job.apply_async()