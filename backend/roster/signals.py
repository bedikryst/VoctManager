# roster/signals.py
import logging
from django.dispatch import receiver
from core.signals import account_soft_deleted

logger = logging.getLogger(__name__)

@receiver(account_soft_deleted)
def handle_account_deletion_for_roster(sender, user, **kwargs):
    """
    Domain Event Handler: Reacts to core identity deletion by soft-deleting the linked artist profile.
    Ensures Roster entities are safely hidden when a core account is erased.
    """
    if hasattr(user, 'artist_profile'):
        user.artist_profile.delete()
        logger.info(f"Artist profile for user {user.id} soft-deleted due to account deletion event.")