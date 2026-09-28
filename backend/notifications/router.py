"""
@file router.py
@description Multi-channel delivery orchestrator. Resolves the reader's
             effective preference per type, asks `plan_delivery` what each
             channel does with the event, and hands the answer to the email and
             push transport tasks. Pure routing — no template logic.
@architecture Enterprise SaaS 2026
@module notifications/router
"""
from typing import Any

from . import push_fold
from .delivery import (
    IN_APP_ONLY_TYPES,
    EmailOutcome,
    PushOutcome,
    default_channel_preferences,
    plan_delivery,
)
from .email_tasks import send_notification_email_task
from .models import (
    AnnouncementSubject,
    NotificationLevel,
    NotificationPreference,
    NotificationType,
)
from .tasks import EmailFallback, send_push_notification_task

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


# Push-first types whose reserve e-mail would arrive as a flood rather than as
# news. Material notices are folded to one per piece per window, but that is
# still one e-mail per piece, and a season's preparation touches many pieces:
# "timely, but not worth an inbox" holds all the more for a member who never
# asked for push. The in-app row still carries it. Revisit only with a
# per-recipient batch ("new material: A, B, C").
_NO_EMAIL_RESERVE: frozenset[str] = frozenset({NotificationType.MATERIAL_UPLOADED})


def _needs_email_reserve(notification_type: str, email_enabled: bool) -> bool:
    """Whether a push of this type should carry its e-mail in reserve.

    Only push-first types qualify — those whose e-mail is OFF by default, so a
    member without a device would otherwise hear nothing. A type whose e-mail is
    ON by default and reads OFF here was switched off by the member, and that
    choice holds even when no device can take the push. The master e-mail switch
    is honoured downstream, by the e-mail dispatcher itself.
    """
    if notification_type in _NO_EMAIL_RESERVE:
        return False
    return not email_enabled and not default_channel_preferences(notification_type)["email_enabled"]


class NotificationRouter:
    """Evaluates user preferences and dispatches to isolated transport tasks."""

    @classmethod
    def route(
        cls,
        recipient_id: str,
        notification_type: str,
        metadata: dict[str, Any],
        level: str = NotificationLevel.INFO,
        notification_id: str | None = None,
    ) -> None:
        """
        Each channel does what ``plan_delivery`` answers for this reader, and
        nothing else decides. The digest shapes e-mail only: a routine INFO
        manager report held for the daily digest sends no e-mail now — the in-app
        row is already persisted and the digest sweep collects it — while its push
        goes out regardless.

        A push-first type (see ``_needs_email_reserve``) sends its push with the
        e-mail in reserve (see ``EmailFallback``): a member no device can reach
        gets the e-mail instead of silence. Only push OFF keeps it in-app only.

        A singer's attendance report is pushed through ``push_fold``, which folds a
        burst of them into one push. `notification_id` names the in-app row the
        fold collects; without it the push goes out on its own.
        """
        # plan_delivery answers NEVER on both channels for these. Returning before
        # the preference read keeps a row from being minted for a type nobody can
        # control.
        if notification_type in IN_APP_ONLY_TYPES:
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
        plan = plan_delivery(
            notification_type,
            level,
            preference={"email_enabled": pref.email_enabled, "push_enabled": pref.push_enabled},
            digest_enabled=cls._digest_enabled(recipient_id),
        )

        template_name = _EMAIL_TEMPLATE_MAP.get(notification_type, "transactional")

        if plan.email is EmailOutcome.NOW:
            send_notification_email_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                template_name=template_name,
                metadata=metadata,
                level=level,
            )

        if plan.push is PushOutcome.NOW:
            if notification_id and push_fold.is_foldable(notification_type, metadata):
                push_fold.hold(
                    recipient_id=str(recipient_id),
                    artist_id=str(metadata["artist_id"]),
                    notification_id=str(notification_id),
                )
                return

            email_fallback: EmailFallback | None = (
                {"template_name": template_name, "metadata": metadata}
                if _needs_email_reserve(notification_type, pref.email_enabled)
                else None
            )
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=notification_type,
                metadata=metadata,
                level=level,
                email_fallback=email_fallback,
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
        # The digest sweep reads rows of the digestible types themselves, never a
        # briefing's own row, so an item held for it here would be lost. No item
        # of a briefing is therefore planned as digestible.
        plans = {
            key: plan_delivery(key, level, preference=value, digest_enabled=False)
            for key, value in preferences.items()
        }

        email_payload = _briefing_for_channel(
            metadata, items,
            allowed={key for key, plan in plans.items() if plan.email is EmailOutcome.NOW},
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
            allowed={key for key, plan in plans.items() if plan.push is PushOutcome.NOW},
        )
        if push_payload is not None:
            # The reserve e-mail carries only what push would and e-mail did not,
            # so an unreached member never reads the same line twice.
            fallback_payload = _briefing_for_channel(
                metadata, items,
                allowed={
                    key for key, plan in plans.items()
                    if plan.push is PushOutcome.NOW
                    and _needs_email_reserve(key, preferences[key]["email_enabled"])
                },
            )
            send_push_notification_task.delay(
                recipient_id=str(recipient_id),
                notification_type=NotificationType.PROJECT_BRIEFING,
                metadata=push_payload,
                level=level,
                email_fallback=(
                    None if fallback_payload is None
                    else {
                        "template_name": _EMAIL_TEMPLATE_MAP[NotificationType.PROJECT_BRIEFING],
                        "metadata": fallback_payload,
                    }
                ),
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
        """Whether the recipient takes routine alerts' e-mail as one daily digest."""
        from core.models import UserProfile
        return UserProfile.objects.filter(
            user_id=recipient_id, digest_enabled=True
        ).exists()
