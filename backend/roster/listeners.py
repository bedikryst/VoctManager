"""
===============================================================================
Roster Domain Listeners (Event Consumers)
===============================================================================
Domain: Roster
Description: 
    Subscribes to cross-domain events emitted by other bounded contexts 
    (e.g., Archive). Translates these external events into localized actions
    such as participant notification logic.

Standards: SaaS 2026, Loose Coupling, Event-Driven Architecture.
===============================================================================
"""

import logging
from django.dispatch import receiver

from archive.signals import piece_material_updated_event
from notifications.tasks import send_bulk_notifications_task
from notifications.models import NotificationType, NotificationLevel
from .models import Participation

logger = logging.getLogger(__name__)


@receiver(piece_material_updated_event)
def handle_piece_material_updated(sender, piece, **kwargs):
    """
    Listens to the Archive domain for material updates.
    Resolves the active project participants linked to this piece and 
    delegates asynchronous notification dispatches.
    """
    logger.debug(f"[RosterListener] Received material update event for piece ID:{piece.id}")

    try:
        # 1. Resolve affected participants strictly within the Roster domain
        user_ids = Participation.objects.filter(
            project__program_items__piece=piece,
            is_deleted=False,
            project__is_deleted=False
        ).values_list('artist__user_id', flat=True).distinct()
        
        recipient_ids = [str(uid) for uid in user_ids if uid]
        
        # 2. Delegate to the Notifications asynchronous worker
        if recipient_ids:
            send_bulk_notifications_task.delay(
                recipient_ids=recipient_ids,
                notification_type=NotificationType.MATERIAL_UPLOADED,
                level=NotificationLevel.INFO,
                metadata={
                    "piece_id": str(piece.id),
                    "piece_title": piece.title,
                    "message": "Sheet music or resources have been updated."
                }
            )
            logger.info(
                f"[RosterListener] Dispatched material update notifications "
                f"to {len(recipient_ids)} users for piece '{piece.title}'."
            )
    except Exception as e:
        logger.error(f"[RosterListener] Failed to process material update for piece {piece.id}: {e}", exc_info=True)