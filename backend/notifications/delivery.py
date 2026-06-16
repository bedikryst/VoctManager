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
