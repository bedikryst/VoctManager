"""
@file push_payloads.py
@description Push projection of the channel-agnostic message layer. The actual
             per-type copy now lives in message_content.py (single source of
             truth for push + email); this module keeps the historical
             PushPayload / PushPayloadBuilder surface so the push transport
             (push_service) is untouched, and adds the synthetic test payload.
@architecture Enterprise SaaS 2026
@module notifications/push_payloads
"""
from __future__ import annotations

from dataclasses import replace
from typing import Any

from django.utils.translation import gettext as _

from .message_content import (
    NOTIFICATION_IDS_KEY,
    MessageContentBuilder,
    PushAction,
    PushPayload,
)
from .models import NotificationLevel

__all__ = ["PushAction", "PushPayload", "PushPayloadBuilder"]


class PushPayloadBuilder:
    """
    Builds a localized PushPayload for a notification type by projecting the
    canonical MessageContent. Must run inside a translation.override() context —
    composers call gettext() at build time.
    """

    @classmethod
    def build(
        cls,
        notification_type: str,
        level: str,
        metadata: dict[str, Any],
        *,
        is_manager: bool,
    ) -> PushPayload:
        content = MessageContentBuilder.build(
            notification_type=notification_type,
            level=level,
            metadata=metadata,
            is_manager=is_manager,
        )
        notification_ids = tuple(
            str(nid) for nid in (metadata or {}).get(NOTIFICATION_IDS_KEY) or ()
        )
        return replace(content.to_push(), notification_ids=notification_ids)

    @classmethod
    def build_test(cls, *, is_manager: bool) -> PushPayload:
        """Synthetic payload used by the Settings → Test push action."""
        return PushPayload(
            title=_("Push notifications are active"),
            body=_(
                "VoctManager will notify you here about rehearsals, casting, and"
                " messages from your management team."
            ),
            url="/panel/settings?tab=notifications",
            tag="voct-test-push",
            notification_type="SYSTEM_TEST",
            level=NotificationLevel.INFO,
            actions=(PushAction(action="view", title=_("Open")),),
        )
