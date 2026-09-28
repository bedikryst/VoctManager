"""
@file push_service.py
@description Web Push transport. Composes a localized, role-aware payload via
             PushPayloadBuilder and delivers it through VAPID to the browser
             push service the subscription names. Every send updates the
             device's health: an accepted push stamps `last_delivered_at` and
             clears the failure count; a refusal adds to it. A device is
             deactivated when its subscription is gone (404/410) or after
             `_MAX_CONSECUTIVE_FAILURES` refusals in a row, so `is_active` —
             and everything counted from it — means "push can reach this".

             VAPID IS THE ONLY TRANSPORT, and that is a property of the product:
             the panel is a PWA, so every device that can hold a subscription is
             a browser. A native client would arrive with its own vendor SDK and
             its own subprocessor entry — neither of which should exist here
             before that client does.
@architecture Enterprise SaaS 2026
@module notifications/push_service
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import F, QuerySet
from django.utils import timezone, translation
from pywebpush import WebPushException, webpush

from core.permissions import user_is_manager

from .dtos import WebPushSubscribeDTO
from .models import DeviceType, NotificationLevel, PushDevice
from .push_payloads import PushPayload, PushPayloadBuilder

logger = logging.getLogger(__name__)
User = get_user_model()

_VAPID_CLAIMS = {
    "sub": f"mailto:{getattr(settings, 'VAPID_CONTACT_EMAIL', 'noreply@voct.pl')}"
}

# RFC 8030 Web Push urgency. Mapped from NotificationLevel (a str-valued TextChoices,
# so the keys double as plain strings for lookups by the serialized level value).
_VAPID_URGENCY: dict[str, str] = {
    NotificationLevel.INFO: "normal",
    NotificationLevel.WARNING: "high",
    NotificationLevel.URGENT: "high",
}

# Time-to-live (seconds) the push service should hold the message if the
# device is offline. Reminders/system alerts get a longer window than chatty
# operational updates.
_DEFAULT_TTL = 60 * 60 * 24  # 24h
_URGENT_TTL = 60 * 60 * 72   # 3 days

# HTTP responses from Web Push services that mean the subscription is gone.
_VAPID_STALE_STATUSES = frozenset({404, 410})

# Any other refusal says nothing definite on its own — a 5xx may pass — but a
# device the push service keeps refusing is unreachable whatever the status: a
# 403 after a VAPID key change, a persistent 5xx. One accepted push resets it.
_MAX_CONSECUTIVE_FAILURES = 5


class PushTransportUnavailable(Exception):
    """The batch delivered nothing and at least one device failed on the network.

    Raised so the Celery task retries. It is safe only because nothing went out:
    with even one device reached, a retry would push the same notice to it twice,
    so a partial network failure is logged and returned as a count instead.
    """


@dataclass(frozen=True)
class TestPushOutcome:
    """What the diagnostic push found.

    Two very different failures both end at zero deliveries, and the settings tab
    has to tell them apart: no registered device is a gap the member closes from
    that very tab, while devices that all rejected the send is an outage they can
    do nothing about. Reporting only the delivered count would collapse them into
    one unhelpful answer.
    """
    devices: int
    delivered: int


def reachable_devices(user_id: int | str) -> QuerySet[PushDevice]:
    """The devices a push to this user is offered to — the dispatcher's own
    filter, for anything that states whether push can reach a member."""
    return PushDevice.objects.filter(user_id=user_id, is_active=True)


@dataclass(frozen=True)
class _DispatchTarget:
    """Resolved per-recipient context computed once per dispatch."""
    user_id: str
    language: str
    is_manager: bool
    devices: tuple[PushDevice, ...]


class PushDispatcherService:
    """
    Enterprise push dispatcher.

    Public surface:
      • dispatch_to_user — production dispatch from Celery workers.
      • send_test_push   — diagnostic dispatch from Settings UI.
      • register_web_push / unregister_device — subscription lifecycle.
    """

    # ------------------------------------------------------------------ #
    # Public dispatch API                                                #
    # ------------------------------------------------------------------ #

    @classmethod
    def dispatch_to_user(
        cls,
        recipient_id: str,
        notification_type: str,
        metadata: dict[str, Any],
        level: str = NotificationLevel.INFO,
    ) -> int:
        """
        Composes a localized payload and fans it out to every active device the
        recipient owns, returning how many devices it actually reached — 0 when
        the recipient has none. The caller decides what an unreached member
        needs; the transport only counts.

        Failures outside the per-device send are re-raised so Celery's retry
        machinery can apply backoff — a transient outage at the browser's push
        service should not be silently swallowed. So is `PushTransportUnavailable`,
        when the network kept every device from being reached.
        """
        target = cls._resolve_target(recipient_id)
        if target is None or not target.devices:
            return 0

        with translation.override(target.language):
            payload = PushPayloadBuilder.build(
                notification_type=notification_type,
                level=level,
                metadata=metadata,
                is_manager=target.is_manager,
            )

        return cls._deliver(target, payload)

    @classmethod
    def send_test_push(cls, user) -> TestPushOutcome:
        """
        Sends a diagnostic notification through the same composition pipeline as
        production dispatch. Reports how many devices the push **actually reached**,
        alongside how many it was offered to.

        Attempts would be the easier number and the wrong one. This is the only
        call in the system whose entire purpose is to answer "does push work for
        me?", and the settings tab offers to mute e-mail on the strength of that
        answer — so a subscription the browser has already discarded has to come
        back as 0 here, not as 1 that was quietly invalidated on the way out.
        """
        target = cls._resolve_target(str(user.id))
        if target is None or not target.devices:
            return TestPushOutcome(devices=0, delivered=0)

        with translation.override(target.language):
            payload = PushPayloadBuilder.build_test(is_manager=target.is_manager)

        try:
            delivered = cls._deliver(target, payload)
        except PushTransportUnavailable:
            # Nothing to retry from a request the member is waiting on: the
            # answer is that the push did not arrive.
            delivered = 0
        if delivered == 0:
            # Every registered device refused it. The per-device lines above name
            # the status; this one is the signal worth alerting on, because the
            # member is now silently unreachable on a channel they enabled.
            logger.error(
                "[PushService] Test push reached NONE of %d device(s) for UID:%s",
                len(target.devices), target.user_id,
            )
        else:
            logger.info(
                "[PushService] Test push reached %d of %d device(s) for UID:%s",
                delivered, len(target.devices), target.user_id,
            )
        return TestPushOutcome(devices=len(target.devices), delivered=delivered)

    # ------------------------------------------------------------------ #
    # Subscription lifecycle                                             #
    # ------------------------------------------------------------------ #

    @classmethod
    def register_web_push(cls, dto: WebPushSubscribeDTO) -> None:
        """Registers or refreshes a browser Web Push (VAPID) subscription."""
        PushDevice.objects.update_or_create(
            registration_token=dto.endpoint,
            defaults={
                "user_id": dto.user_id,
                "device_type": DeviceType.WEB,
                "p256dh_key": dto.p256dh_key,
                "auth_key": dto.auth_key,
                "is_active": True,
                "is_deleted": False,
                "consecutive_failures": 0,
            },
        )
        logger.info("[PushService] Web Push subscription registered for UID:%s", dto.user_id)

    @classmethod
    def unregister_device(cls, user_id: str, token: str) -> None:
        """Hard-deletes a push subscription/token (logout or explicit unsubscribe)."""
        deleted_count, _ = PushDevice.objects.filter(
            user_id=user_id,
            registration_token=token,
        ).delete()
        if deleted_count > 0:
            logger.info("[PushService] Push subscription unregistered for UID:%s", user_id)

    # ------------------------------------------------------------------ #
    # Internals                                                          #
    # ------------------------------------------------------------------ #

    @classmethod
    def _resolve_target(cls, recipient_id: str) -> _DispatchTarget | None:
        try:
            user = User.objects.select_related("profile").get(id=recipient_id)
        except User.DoesNotExist:
            logger.warning("[PushService] Recipient UID:%s not found.", recipient_id)
            return None

        devices = tuple(reachable_devices(user.id))
        if not devices:
            return None

        profile = getattr(user, "profile", None)
        language = getattr(profile, "language", "en") or "en"
        is_manager = user_is_manager(user)

        return _DispatchTarget(
            user_id=str(user.id),
            language=language,
            is_manager=is_manager,
            devices=devices,
        )

    @classmethod
    def _deliver(cls, target: _DispatchTarget, payload: PushPayload) -> int:
        """Send the payload, and report how many devices it actually reached.
        Both callers act on the number: production dispatch hands an unreached
        member to e-mail, and `send_test_push` exists to state it — so the
        transport has to count rather than assume."""
        return cls._send_vapid_batch(list(target.devices), payload, target.language)

    # ------------------------------------------------------------------ #
    # VAPID (Web Push)                                                   #
    # ------------------------------------------------------------------ #

    @classmethod
    def _send_vapid_batch(
        cls,
        devices: list[PushDevice],
        payload: PushPayload,
        language: str,
    ) -> int:
        data = payload.to_dict()
        data["lang"] = language  # lets the SW set <notification lang> for a11y
        body = json.dumps(data, ensure_ascii=False)
        urgency = _VAPID_URGENCY.get(payload.level, "normal")
        ttl = _URGENT_TTL if payload.level == NotificationLevel.URGENT else _DEFAULT_TTL

        stale_ids: list[UUID] = []
        refused_ids: list[UUID] = []
        delivered_ids: list[UUID] = []
        network_failures = 0

        for device in devices:
            if not device.p256dh_key or not device.auth_key:
                # Without the encryption keys no push can ever be sent to it, so
                # it is invalidated like a gone subscription rather than skipped
                # while still counting as a way to reach its member.
                logger.warning(
                    "[PushService] WEB device %s missing VAPID keys, invalidating.",
                    device.id,
                )
                stale_ids.append(device.id)
                continue
            try:
                webpush(
                    subscription_info={
                        "endpoint": device.registration_token,
                        "keys": {"p256dh": device.p256dh_key, "auth": device.auth_key},
                    },
                    data=body,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={**_VAPID_CLAIMS},
                    ttl=ttl,
                    headers={"Urgency": urgency},
                )
                delivered_ids.append(device.id)
            except WebPushException as exc:
                status_code = exc.response.status_code if exc.response is not None else None
                if status_code in _VAPID_STALE_STATUSES:
                    stale_ids.append(device.id)
                else:
                    refused_ids.append(device.id)
                    logger.error(
                        "[PushService] VAPID send failed for device %s (status=%s): %s",
                        device.id, status_code, exc,
                    )
            except requests.RequestException as exc:
                # No answer came back, so nothing is learned about the
                # subscription: the outage is ours or the push service's. It
                # neither counts towards deactivation nor resets the count — the
                # retry raised below would otherwise turn one outage into four
                # strikes on every device of every recipient.
                network_failures += 1
                logger.warning(
                    "[PushService] VAPID send to device %s did not complete: %s",
                    device.id, exc,
                )
            except Exception:
                # Raised on our side of the wire, most often by a subscription
                # key the encryption step cannot use. Escaping here would abandon
                # the batch mid-loop, and the task's retry would push the notice
                # again to every device already reached. It counts as a refusal,
                # so a device that always fails this way is deactivated in time.
                refused_ids.append(device.id)
                logger.exception(
                    "[PushService] VAPID send to device %s raised before any answer.",
                    device.id,
                )

        cls._record_device_health(
            delivered_ids=delivered_ids, refused_ids=refused_ids, stale_ids=stale_ids,
        )

        if not delivered_ids and network_failures:
            raise PushTransportUnavailable(
                f"{network_failures} of {len(devices)} device(s) unreachable on the network"
            )
        return len(delivered_ids)

    @classmethod
    def _record_device_health(
        cls,
        *,
        delivered_ids: list[UUID],
        refused_ids: list[UUID],
        stale_ids: list[UUID],
    ) -> None:
        """Writes one batch's outcome back to its devices, in bulk."""
        if delivered_ids:
            PushDevice.objects.filter(id__in=delivered_ids).update(
                last_delivered_at=timezone.now(), consecutive_failures=0,
            )

        if refused_ids:
            PushDevice.objects.filter(id__in=refused_ids).update(
                consecutive_failures=F("consecutive_failures") + 1,
            )
            exhausted = PushDevice.objects.filter(
                id__in=refused_ids,
                is_active=True,
                consecutive_failures__gte=_MAX_CONSECUTIVE_FAILURES,
            ).update(is_active=False)
            if exhausted:
                logger.warning(
                    "[PushService] Deactivated %d device(s) after %d refusals in a row.",
                    exhausted, _MAX_CONSECUTIVE_FAILURES,
                )

        if stale_ids:
            invalidated = PushDevice.objects.filter(id__in=stale_ids).update(is_active=False)
            logger.warning(
                "[PushService] Auto-invalidated %d stale Web Push subscriptions.",
                invalidated,
            )
