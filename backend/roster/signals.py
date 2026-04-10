# roster/signals.py
# ==========================================
# Roster Domain Event Listeners (Signals)
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Domain-driven event handlers ensuring eventual consistency between the 
Core (IAM) Bounded Context and the Roster application.
Enforces the Single Source of Truth (SSoT) paradigm without tight coupling.
"""
import logging
from django.dispatch import receiver
from django.db import transaction

from core.signals import user_pii_updated, user_email_changed, account_soft_deleted
from .models import Artist

logger = logging.getLogger(__name__)


@receiver(user_email_changed)
def sync_artist_email(sender, user, old_email: str, new_email: str, **kwargs) -> None:
    """
    Synchronizes the HR Artist profile when the core identity email changes.
    Prevents data desynchronization and maintains SSoT.
    """
    # Bulk update is utilized for atomic, high-performance execution without loading the instance
    updated_count = Artist.objects.filter(user=user, is_deleted=False).update(email=new_email)
    if updated_count:
        logger.info(f"Roster Domain Event: Synchronized email for artist ID {user.id} to {new_email}")


@receiver(user_pii_updated)
def sync_artist_pii(sender, user, dto, **kwargs) -> None:
    """
    Updates the Artist's Personally Identifiable Information (PII) 
    when changes occur in the core user preferences.
    """
    try:
        artist = Artist.objects.get(user=user, is_deleted=False)
        
        artist.first_name = dto.first_name
        artist.last_name = dto.last_name
        if dto.phone_number:
            artist.phone_number = dto.phone_number
            
        artist.save(update_fields=['first_name', 'last_name', 'phone_number', 'updated_at'])
        logger.info(f"Roster Domain Event: Synchronized PII for artist ID {artist.id}")
        
    except Artist.DoesNotExist:
        # Expected behavior if a core IAM user exists without a linked Roster entity (e.g., pure admins)
        pass


@receiver(account_soft_deleted)
def handle_gdpr_artist_deletion(sender, user, **kwargs) -> None:
    """
    Executes GDPR Right to Erasure workflows for the Roster domain.
    Anonymizes contact data while preserving names for historical/legal contracts (e.g., ZAiKS).
    Soft-deletes the entity to exclude it from active dashboards.
    """
    try:
        artist = Artist.objects.get(user=user, is_deleted=False)
        
        with transaction.atomic():
            # 1. GDPR Anonymization of contact channels
            artist.email = f"archived_{artist.id}@deleted.local"
            artist.phone_number = ""
            artist.save(update_fields=['email', 'phone_number', 'updated_at'])
            
            # 2. Soft-delete to hide from active project rosters
            artist.delete()
            
        logger.info(f"Roster Domain Event: Artist ID {artist.id} GDPR-anonymized and soft-deleted.")
        
    except Artist.DoesNotExist:
        pass