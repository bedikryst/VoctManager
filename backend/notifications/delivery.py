"""
@file delivery.py
@description Delivery-tier classification for the notification router. Separates
             the steady stream of routine, informational manager alerts (which are
             batched into a once-daily digest) from everything that must reach the
             recipient in real time. The axis is urgency, not topic: a digestible
             type escalated to WARNING/URGENT (e.g. a singer *declining* a concert)
             still breaks through immediately.
@architecture Enterprise SaaS 2026
@module notifications/delivery
"""
from __future__ import annotations

from .models import NotificationLevel, NotificationType

# Single source of truth for default channel preferences. The settings API and
# the router both use these values, so a first delivered event cannot silently
# create a preference that differs from what the UI showed the user.
#
# The organizing line is "would a busy singer want this in their inbox?":
#   • Tier 1 — Commitments, decisions & direct messages (email ON + push ON): the
#     recipient must not miss these even if they never open the app. Anything that
#     changes what they've committed to (an invitation, a concert or rehearsal
#     scheduled / moved / cancelled), a decision on their own request (absence
#     approved / rejected), a contract to sign, or a person writing to them
#     directly (a thread message, a management broadcast).
#   • Tier 2 — Preparation, content & nudges (push ON, email OFF): timely but not
#     inbox-worthy — reminders, casting, new sheet music / recordings, system
#     notices. Casting and materials also fan out in bulk (a whole cast at once),
#     so a per-event email would flood; the push + in-app row is enough.
#   • Tier 3 — Manager routine fan-out (push ON, real-time email OFF): the
#     per-event email is replaced by the once-daily digest; WARNING escalations
#     (e.g. a singer declining) still break through to push in real time.
#
# Push therefore defaults ON for every routed type — it only reaches users who have
# explicitly subscribed a device — while email is reserved for the Tier 1 set.
DEFAULT_EMAIL_ENABLED_TYPES: frozenset[str] = frozenset({
    NotificationType.PROJECT_INVITATION,
    NotificationType.PROJECT_UPDATED,     # a concert moving is as must-know as a rehearsal moving
    NotificationType.PROJECT_CANCELLED,
    NotificationType.REHEARSAL_SCHEDULED,
    NotificationType.REHEARSAL_UPDATED,
    NotificationType.REHEARSAL_CANCELLED,
    NotificationType.CONTRACT_ISSUED,
    NotificationType.MESSAGE_RECEIVED,
    NotificationType.CUSTOM_ADMIN_MESSAGE,  # management writing to you directly — parity with a DM
    NotificationType.ABSENCE_APPROVED,      # the outcome of your own request should reach you reliably
    NotificationType.ABSENCE_REJECTED,      # …in both directions, so good news isn't only in-app
})

# Nothing is push-off by default: push is opt-in at the device level, so a
# subscribed user has signalled they want it. Kept as an explicit SSOT seam so a
# future noisy type can be demoted in one place.
DEFAULT_PUSH_DISABLED_TYPES: frozenset[str] = frozenset()

# Routine, high-volume manager fan-out alerts. At INFO level these are collected
# into the daily digest instead of firing an immediate email + push per event.
DIGESTIBLE_TYPES: frozenset[str] = frozenset({
    NotificationType.ATTENDANCE_SUBMITTED,
    NotificationType.PARTICIPATION_RESPONSE,
    NotificationType.ABSENCE_REQUESTED,
})


def is_digestible(notification_type: str, level: str) -> bool:
    """
    True when an event is a routine informational manager alert that belongs in the
    daily digest rather than a real-time channel. WARNING/URGENT always returns
    False so actionable events are never deferred.
    """
    return (
        notification_type in DIGESTIBLE_TYPES
        and (level or NotificationLevel.INFO) == NotificationLevel.INFO
    )


def default_channel_preferences(notification_type: str) -> dict[str, bool]:
    """Default email/push state for a notification type before user overrides."""
    return {
        "email_enabled": notification_type in DEFAULT_EMAIL_ENABLED_TYPES,
        "push_enabled": notification_type not in DEFAULT_PUSH_DISABLED_TYPES,
    }
