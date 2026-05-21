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
from typing import Any

from celery import group, shared_task

from .dtos import NotificationCreateDTO
from .models import NotificationLevel
from .services import NotificationService

logger = logging.getLogger(__name__)


# --- 1. CORE NOTIFICATION PROVISIONING ---

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
    recipient_id: int | str,
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: dict[str, Any] | None = None
) -> None:
    """
    Entry boundary. Rehydrates payloads into strictly validated DTOs and delegates to service.
    (This remains largely unchanged, as NotificationService.create_notification will now call the router via on_commit).
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

# --- 2. MULTI-CHANNEL ROUTING ---

@shared_task(name="notifications.route_notification")
def route_notification_task(
    recipient_id: str,
    notification_type: str,
    metadata: dict[str, Any],
    level: str = NotificationLevel.INFO,
) -> None:
    """
    Evaluates DB preferences and dynamically spawns isolated transport tasks.
    Invoked strictly after Notification DB transaction commits.
    """
    from .router import NotificationRouter
    NotificationRouter.route(
        recipient_id=recipient_id,
        notification_type=notification_type,
        metadata=metadata,
        level=level,
    )

# --- 3. PUSH TRANSPORT ---

@shared_task(
    name="notifications.send_push_notification",
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_jitter=True
)
def send_push_notification_task(
    self,
    recipient_id: str,
    notification_type: str,
    metadata: dict[str, Any],
    level: str = NotificationLevel.INFO,
) -> None:
    """
    Isolated transport task for VAPID + FCM dispatch. Delegates payload
    composition to the dispatcher service; transient transport failures are
    retried with exponential backoff.
    """
    try:
        from .push_service import PushDispatcherService
        PushDispatcherService.dispatch_to_user(
            recipient_id=recipient_id,
            notification_type=notification_type,
            metadata=metadata,
            level=level,
        )
    except Exception as exc:
        logger.error(f"[Task] Push transport failed for UID:{recipient_id}. Retrying... Reason: {exc}")
        raise self.retry(exc=exc)

# --- 4. FAN-OUT ORCHESTRATION ---

@shared_task(name="notifications.send_bulk_notifications")
def send_bulk_notifications_task(
    recipient_ids: list[int | str], 
    notification_type: str, 
    level: str = NotificationLevel.INFO, 
    metadata: dict[str, Any] | None = None
) -> None:
    """
    Optimized Fan-Out orchestrator for broadcast events.
    Maintains compatibility with the new routing flow automatically because it delegates
    to send_notification_task, which triggers the DB transaction and subsequent routing.
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