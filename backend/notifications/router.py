"""
@file router.py
@description Multi-channel delivery orchestrator. Reads granular per-type
             user preferences and fans the notification out to the email and
             push transport tasks. Pure routing — no template logic.
@architecture Enterprise SaaS 2026
@module notifications/router
"""
from typing import Any

from .delivery import default_channel_preferences, is_digestible
from .email_tasks import send_notification_email_task
from .models import (
    AnnouncementSubject,
    NotificationLevel,
    NotificationPreference,
    NotificationType,
)
from .tasks import send_push_notification_task

# Per-type override map. Falls back to the structured `transactional` template
# (fed by the message_content layer) for everything else.
#
# `briefing` is not a bespoke template: it reads the same composed, localized
# context as `transactional` and only lays out the grouped sections that a
# composite briefing carries and a single-event notification does not.
_EMAIL_TEMPLATE_MAP: dict[str, str] = {
    NotificationType.CUSTOM_ADMIN_MESSAGE: "custom_admin_message",
    NotificationType.MESSAGE_RECEIVED: "message_received",
    NotificationType.PROJECT_BRIEFING: "briefing",
}


def _briefing_for_channel(
    metadata: dict[str, Any],
    items: list[dict[str, Any]],
    *,
    allowed: set[str],
) -> dict[str, Any] | None:
    """This channel's copy of a briefing, or None when nothing on it survives.

    The calendar is dropped whole if any rehearsal was filtered out: publication
    lifted the events out of their items (attachments are per message), so they
    can no longer be matched back one by one — and an attachment naming dates this
    copy does not mention would put a phantom rehearsal in someone's diary. A
    missing `.ics` is recoverable; a wrong one is not.
    """
    kept = [item for item in items if item.get("notification_type") in allowed]
    if not kept:
        return None

    payload = {**metadata, "items": kept}
    if len(kept) != len(items) and any(
        item.get("subject_type") == AnnouncementSubject.REHEARSAL
        for item in items
        if item.get("notification_type") not in allowed
    ):
        payload["ics"] = []
    return payload


class NotificationRouter:
    """Evaluates user preferences and dispatches to isolated transport tasks."""

    @classmethod
    def route(
        cls,
        recipient_id: str,
        notification_type: str,
        metadata: dict[str, Any],
        level: str = NotificationLevel.INFO,
    ) -> None:
        """
        NOTIFICATION_READ_RECEIPT is in-app only — no email or push by design.
        Routine INFO manager alerts are held back from real-time channels when the
        recipient has the daily digest enabled; the in-app row is already persisted
        and the digest sweep collects it. Disabling the digest restores immediate
        delivery through the recipient's enabled real-time channels.
        """
        if notification_type == NotificationType.NOTIFICATION_READ_RECEIPT:
            return

        if is_digestible(notification_type, level) and cls._digest_enabled(recipient_id):
            return

        # A briefing is a delivery shape, not a category — it carries several
        # events, each with a preference of its own. Honouring the envelope's
        # preference would let the fold overrule every one of them.
        if notification_type == NotificationType.PROJECT_BRIEFING:
            cls._route_briefing(recipient_id, metadata, level)
            return

        pref, _ = NotificationPreference.objects.get_or_create(
            user_id=recipient_id,
            notification_type=notification_type,
            defaults=default_channel_preferences(notification_type),
        )

        template_name = _EMAIL_TEMPLATE_MAP.get(notification_type, "transactional")

        if pref.email_enabled:
            send_notification_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                template_name=template_name,
                metadata=metadata,
                level=level,
            )

        if pref.push_enabled:
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                metadata=metadata,
                level=level,
            )

    @classmethod
    def _route_briefing(
        cls, recipient_id: str, metadata: dict[str, Any], level: str
    ) -> None:
        """Route a composite briefing per *item*, not per envelope.

        The fold is a delivery decision made by the conductor's publication, and
        it must not silently overrule what the reader asked for. A briefing that
        happens to gather a rehearsal move and a casting change carries two
        different preferences, and the reader who switched casting e-mail off
        expects that to hold however the news travels.

        So each channel is answered separately, and each carries only the items
        enabled on it. Push and e-mail may therefore contain different lines —
        which is correct, not a discrepancy. The in-app row is untouched and
        always complete: the bell is a record, not a channel.

        Preference rows are read, never created here. A briefing mentioning a type
        the reader has never received should not mint a row for it.
        """
        items = [
            item for item in (metadata.get("items") or ())
            if isinstance(item, dict)
        ]
        notification_types = {
            str(item.get("notification_type") or "") for item in items
        } - {""}
        if not notification_types:
            # Nothing identifiable to answer for. The in-app row already carries
            # it; staying silent on the outbound channels is the safe reading.
            return

        preferences = cls._effective_preferences(recipient_id, notification_types)

        email_payload = _briefing_for_channel(
            metadata, items,
            allowed={
                key for key, value in preferences.items() if value["email_enabled"]
            },
        )
        if email_payload is not None:
            send_notification_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=NotificationType.PROJECT_BRIEFING,
                template_name=_EMAIL_TEMPLATE_MAP[NotificationType.PROJECT_BRIEFING],
                metadata=email_payload,
                level=level,
            )

        push_payload = _briefing_for_channel(
            metadata, items,
            allowed={
                key for key, value in preferences.items() if value["push_enabled"]
            },
        )
        if push_payload is not None:
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=NotificationType.PROJECT_BRIEFING,
                metadata=push_payload,
                level=level,
            )

    @staticmethod
    def _effective_preferences(
        recipient_id: str, notification_types: set[str]
    ) -> dict[str, dict[str, bool]]:
        """What each type resolves to for this reader — their stored row where one
        exists, the shared default contract where it does not."""
        stored = {
            preference.notification_type: preference
            for preference in NotificationPreference.objects.filter(
                user_id=recipient_id, notification_type__in=notification_types
            )
        }
        resolved: dict[str, dict[str, bool]] = {}
        for notification_type in notification_types:
            defaults = default_channel_preferences(notification_type)
            preference = stored.get(notification_type)
            resolved[notification_type] = {
                "email_enabled": (
                    preference.email_enabled if preference else defaults["email_enabled"]
                ),
                "push_enabled": (
                    preference.push_enabled if preference else defaults["push_enabled"]
                ),
            }
        return resolved

    @staticmethod
    def _digest_enabled(recipient_id: str) -> bool:
        """Whether the recipient batches routine alerts into the daily digest."""
        from core.models import UserProfile
        return UserProfile.objects.filter(
            user_id=recipient_id, digest_enabled=True
        ).exists()
