"""
@file signals.py
@description ESP delivery-event handling. Connects to Anymail's tracking webhook
             signal so the suppression state stays honest: a hard bounce or spam
             complaint marks the recipient address undeliverable (stopping further
             notification email), and an ESP-side unsubscribe flips the user's
             operational-email opt-out. Soft/transient failures are ignored.
@architecture Enterprise SaaS 2026
@module notifications/signals
"""
import logging

from anymail.signals import tracking  # type: ignore[import-untyped]
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# Anymail-normalized reject reasons that mean the address itself is bad (as opposed
# to a transient timeout/deferral, which should not suppress).
_HARD_BOUNCE_REASONS = frozenset({"invalid", "bounced", "blocked", "spam"})


@receiver(tracking, dispatch_uid="notifications.esp_tracking")
def handle_esp_tracking(sender, event, esp_name, **kwargs) -> None:
    """React to ESP delivery events: suppress bad/complaining addresses."""
    from core.models import UserProfile

    recipient = (getattr(event, "recipient", "") or "").strip().lower()
    if not recipient:
        return

    event_type = getattr(event, "event_type", "")
    reject_reason = getattr(event, "reject_reason", None)
    profiles = UserProfile.objects.filter(user__email__iexact=recipient)

    if event_type == "complained" or (
        event_type in ("bounced", "rejected") and reject_reason in _HARD_BOUNCE_REASONS
    ):
        updated = profiles.update(email_undeliverable=True)
        if updated:
            logger.warning(
                "[ESPTracking] %s (reason=%s) for %s — %d address(es) marked undeliverable.",
                event_type, reject_reason, recipient, updated,
            )
    elif event_type == "unsubscribed":
        updated = profiles.update(email_notifications_enabled=False)
        if updated:
            logger.info("[ESPTracking] unsubscribe for %s — opted out of operational email.", recipient)
