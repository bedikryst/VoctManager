"""
@file signals.py
@description ESP delivery-event handling. Connects to Anymail's tracking webhook
             signal so the suppression state stays honest: a hard bounce or spam
             complaint marks the recipient address undeliverable (stopping further
             notification email), and an ESP-side unsubscribe flips the user's
             operational-email opt-out. Soft/transient failures are ignored.

             THE RECIPIENT IS NOT ALWAYS A MEMBER. The same webhook reports on mail
             sent to the concert notice list, whose subscribers have no user row at
             all — for them the answer is not a suppression flag but the end of the
             consent, since on that list the mailbox IS the relationship.
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


def _withdraw_notice_consent(recipient: str, why: str) -> None:
    """
    Ends the address's place on the concert notice list, if it has one.

    Imported inside the call, like the profile lookup above it: this module is loaded
    from `AppConfig.ready()`, and `outreach.services` reaches back into this app's own
    email service.
    """
    from outreach.services import NoticeListService

    if NoticeListService.withdraw_by_address(recipient):
        logger.warning(
            "[ESPTracking] %s for %s — concert notice subscription withdrawn.", why, recipient,
        )


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
        # A complaint is a person saying they never agreed to this, and a dead mailbox
        # can no longer carry the one thing the consent licensed. Either way the list
        # has nothing left to send to, and keeping the address would be keeping it for
        # our own sake — so the consent ends and the log records that it did.
        _withdraw_notice_consent(recipient, f"{event_type} (reason={reject_reason})")
    elif event_type == "unsubscribed":
        updated = profiles.update(email_notifications_enabled=False)
        if updated:
            logger.info("[ESPTracking] unsubscribe for %s — opted out of operational email.", recipient)
        # Our own `List-Unsubscribe` points at this backend, so a one-click withdrawal
        # normally never becomes an ESP event. This covers the provider that handles the
        # header itself — and the day the provider changes, which is a live question.
        _withdraw_notice_consent(recipient, event_type)
