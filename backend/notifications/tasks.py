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
from typing import Dict, Any, Optional, List
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
    retry_backoff=True, # Exponential backoff prevents thundering herd problem
    retry_jitter=True   # Adds randomness to backoff to smooth out load
)
def send_notification_task(
    self, 
    recipient_id: str, 
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
        # Boundary Validation: Ensure payload from Redis meets strict schema
        dto = NotificationCreateDTO(
            recipient_id=recipient_id,
            notification_type=notification_type,
            level=level,
            metadata=metadata or {}
        )
        
        # Execute Domain Logic
        NotificationService.create_notification(dto=dto)
        
    except Exception as exc:
        logger.error(f"[Task] send_notification failed for UID:{recipient_id}. Retrying... Reason: {exc}")
        # Manual retry call in case exceptions aren't caught by autoretry_for config
        raise self.retry(exc=exc)


@shared_task(name="notifications.send_bulk_notifications")
def send_bulk_notifications_task(
    recipient_ids: List[str], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Highly optimized Fan-Out orchestrator for broadcast events (e.g., full choir updates).
    
    Anti-Pattern Avoided: 
        Looping `task.delay()` forces individual synchronous round-trips to the Redis broker,
        bottlenecking the worker thread.
        
    Enterprise Solution:
        Bundles signatures into a `celery.group` and dispatches them as a single bulk payload 
        to the broker. This reduces network I/O from O(N) to O(1).
    """
    if not recipient_ids:
        logger.warning("[Task] send_bulk_notifications invoked with an empty recipient list. Aborting.")
        return

    logger.info(f"[Task] Orchestrating bulk dispatch of [{notification_type}] to {len(recipient_ids)} users.")

    # 1. Compile immutable signatures for individual executions
    signatures = [
        send_notification_task.s(
            recipient_id=uid, 
            notification_type=notification_type, 
            level=level, 
            metadata=metadata
        )
        for uid in recipient_ids
    ]
    
    # 2. Bundle and dispatch asynchronously (Fire and Forget)
    job = group(signatures)
    job.apply_async()