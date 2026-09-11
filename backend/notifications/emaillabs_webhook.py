"""
@file emaillabs_webhook.py
@description EmailLabs delivery-report webhook, normalized into Anymail's
             tracking vocabulary so `notifications/signals.py` keeps working
             unchanged — the suppression ledger must not know which ESP is
             configured.

             TWO STATUSES SUPPRESS AN ADDRESS, AND ONLY TWO: `hardbounce` (the
             mailbox does not exist) and `feedback` (the reader pressed "this is
             spam"). Everything else is recorded and let go. `spambounce` and
             `dropped` look like permanent failures and are not: the first is a
             receiving filter's verdict, which false-positives, and the second
             includes "account limit exceeded", which is our fault and not the
             reader's. Suppressing on either would silently unreach a member —
             the exact failure this system fights, arriving from the side that
             looks like diligence.

             THE PAYLOAD FIELD NAMES ARE NOT PUBLICLY DOCUMENTED. Rather than
             guess one spelling and fail closed, each field is read from a small
             set of candidates and anything unrecognized is logged whole. The
             first production events are expected to narrow this — see the
             runbook in docs/messaging-providers-2026-09.md.
@architecture Enterprise SaaS 2026
@module notifications/emaillabs_webhook
"""
from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from anymail.signals import (  # type: ignore[import-untyped]
    AnymailTrackingEvent,
    EventType,
    RejectReason,
    tracking,
)
from anymail.webhooks.base import AnymailBaseWebhookView  # type: ignore[import-untyped]
from django.http import HttpRequest

logger = logging.getLogger(__name__)

# EmailLabs status → (Anymail event type, reject reason). See the module docstring
# for why only two of these end in a suppression.
_STATUS_MAP: dict[str, tuple[str, str | None]] = {
    "injected": (EventType.QUEUED, None),
    "ok": (EventType.DELIVERED, None),
    "delivered": (EventType.DELIVERED, None),
    "open": (EventType.OPENED, None),
    "track": (EventType.CLICKED, None),
    "click": (EventType.CLICKED, None),
    "deferred": (EventType.DEFERRED, None),
    "softbounce": (EventType.DEFERRED, None),
    "soft_bounce": (EventType.DEFERRED, None),
    "hardbounce": (EventType.BOUNCED, RejectReason.BOUNCED),
    "hard_bounce": (EventType.BOUNCED, RejectReason.BOUNCED),
    "spambounce": (EventType.BOUNCED, RejectReason.OTHER),
    "spam_bounce": (EventType.BOUNCED, RejectReason.OTHER),
    "dropped": (EventType.REJECTED, RejectReason.OTHER),
    "feedback": (EventType.COMPLAINED, RejectReason.SPAM),
    "complaint": (EventType.COMPLAINED, RejectReason.SPAM),
    "unsubscribe": (EventType.UNSUBSCRIBED, RejectReason.UNSUBSCRIBED),
    "unsubscribed": (EventType.UNSUBSCRIBED, RejectReason.UNSUBSCRIBED),
}

_RECIPIENT_KEYS = ("email", "recipient", "to", "address", "mail")
_STATUS_KEYS = ("status", "event", "event_type", "type", "state")
_MESSAGE_ID_KEYS = ("message_id", "req_id", "id", "smtp_id")
_TIMESTAMP_KEYS = ("timestamp", "date", "time", "event_time", "created_at")
_DESCRIPTION_KEYS = ("description", "message", "reason", "info", "diag")


def _first(event: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = event.get(key)
        if value not in (None, ""):
            return value
    return None


def _parse_timestamp(raw: Any) -> datetime | None:
    """Best effort only: an event with an unreadable time is still a valid event."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(float(raw), tz=UTC)
        except (OverflowError, OSError, ValueError):
            return None
    if isinstance(raw, str):
        text = raw.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


class EmailLabsTrackingWebhookView(AnymailBaseWebhookView):
    """
    Receives EmailLabs delivery reports and re-emits them as Anymail events.

    Security is HTTP basic auth, configured on both ends: "Authentication mode →
    Basic auth" in the EmailLabs panel, and `basic_auth` passed to this view from
    `config/urls.py`. It is passed there rather than through Anymail's global
    `WEBHOOK_SECRET` setting on purpose — that setting applies to every Anymail
    webhook at once, and switching it on would start rejecting the Resend
    webhook that is still live during the transition.
    """

    esp_name = "EmailLabs"
    # The signal `notifications/signals.py` already listens on. Naming it here is what
    # makes this view interchangeable with Anymail's own: the suppression receiver
    # never learns which provider sent the event.
    signal = tracking
    # Their reports carry no signature, so basic auth is the whole of the security
    # and Anymail's warning about that is correct rather than noisy.
    warn_if_no_basic_auth = True

    def parse_events(self, request: HttpRequest) -> list[AnymailTrackingEvent]:
        try:
            body = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            logger.error("[EmailLabsWebhook] Body was not JSON; %d bytes discarded.", len(request.body))
            return []

        raw_events = self._extract_events(body)
        events: list[AnymailTrackingEvent] = []
        for raw in raw_events:
            event = self._build_event(raw)
            if event is not None:
                events.append(event)
        return events

    @staticmethod
    def _extract_events(body: Any) -> list[dict[str, Any]]:
        """EmailLabs posts an array; accept the single-object and wrapped forms too."""
        if isinstance(body, list):
            return [item for item in body if isinstance(item, dict)]
        if isinstance(body, dict):
            for key in ("events", "data", "items", "reports"):
                nested = body.get(key)
                if isinstance(nested, list):
                    return [item for item in nested if isinstance(item, dict)]
            return [body]
        logger.error("[EmailLabsWebhook] Unexpected payload type %s.", type(body).__name__)
        return []

    def _build_event(self, raw: dict[str, Any]) -> AnymailTrackingEvent | None:
        recipient = _first(raw, _RECIPIENT_KEYS)
        status = _first(raw, _STATUS_KEYS)

        if not recipient or not status:
            # Logged whole: this is the only way the undocumented field names get
            # discovered, and an event we cannot read is worth more in the log than
            # dropped in silence.
            logger.warning("[EmailLabsWebhook] Unreadable event, raw payload: %s", raw)
            return None

        key = str(status).strip().lower().replace("-", "_")
        mapped = _STATUS_MAP.get(key)
        if mapped is None:
            logger.warning("[EmailLabsWebhook] Unknown status %r; raw payload: %s", status, raw)
            event_type, reject_reason = EventType.UNKNOWN, None
        else:
            event_type, reject_reason = mapped

        tags = raw.get("tags")
        return AnymailTrackingEvent(
            event_type=event_type,
            esp_event=raw,
            recipient=str(recipient).strip().lower(),
            reject_reason=reject_reason,
            message_id=_first(raw, _MESSAGE_ID_KEYS),
            timestamp=_parse_timestamp(_first(raw, _TIMESTAMP_KEYS)),
            description=_first(raw, _DESCRIPTION_KEYS),
            tags=[str(tag) for tag in tags] if isinstance(tags, list) else [],
        )
