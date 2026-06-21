"""
@file push_service.py
@description Dual-channel push transport. Composes a localized, role-aware
             payload via PushPayloadBuilder and delivers it through VAPID
             (browsers) or FCM (iOS/Android). Stale subscriptions are
             auto-invalidated on permanent failures.
@architecture Enterprise SaaS 2026
@module notifications/push_service
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import translation
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from pywebpush import WebPushException, webpush

from core.constants import AppRole

from .dtos import PushDeviceRegisterDTO, WebPushSubscribeDTO
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

# FCM permanent-failure codes that mean the token must be retired.
_FCM_STALE_CODES = frozenset({"UNREGISTERED", "SENDER_ID_MISMATCH", "INVALID_ARGUMENT"})

# HTTP responses from Web Push services that mean the subscription is gone.
_VAPID_STALE_STATUSES = frozenset({404, 410})


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
      • register_web_push / register_device / unregister_device — subscription lifecycle.
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
    ) -> None:
        """
        Composes a localized payload and fans it out to every active device the
        recipient owns. Failures are logged and re-raised so Celery's retry
        machinery can apply backoff — transient FCM/VAPID outages should not
        be silently swallowed.
        """
        target = cls._resolve_target(recipient_id)
        if target is None or not target.devices:
            return

        with translation.override(target.language):
            payload = PushPayloadBuilder.build(
                notification_type=notification_type,
                level=level,
                metadata=metadata,
                is_manager=target.is_manager,
            )

        cls._deliver(target, payload)

    @classmethod
    def send_test_push(cls, user) -> int:
        """
        Sends a diagnostic notification through the same composition pipeline as
        production dispatch. Returns the device count we attempted to reach.
        """
        target = cls._resolve_target(str(user.id))
        if target is None or not target.devices:
            return 0

        with translation.override(target.language):
            payload = PushPayloadBuilder.build_test(is_manager=target.is_manager)

        cls._deliver(target, payload)
        logger.info(
            "[PushService] Test push dispatched to %d device(s) for UID:%s",
            len(target.devices), target.user_id,
        )
        return len(target.devices)

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
            },
        )
        logger.info("[PushService] Web Push subscription registered for UID:%s", dto.user_id)

    @classmethod
    def register_device(cls, dto: PushDeviceRegisterDTO) -> None:
        """Registers or reactivates an FCM push token (iOS / Android)."""
        PushDevice.objects.update_or_create(
            registration_token=dto.registration_token,
            defaults={
                "user_id": dto.user_id,
                "device_type": dto.device_type,
                "is_active": True,
                "is_deleted": False,
            },
        )
        logger.info("[PushService] FCM device token registered for UID:%s", dto.user_id)

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

        devices = tuple(PushDevice.objects.filter(user=user, is_active=True))
        if not devices:
            return None

        profile = getattr(user, "profile", None)
        language = getattr(profile, "language", "en") or "en"
        role = getattr(profile, "role", None)
        is_manager = role == AppRole.MANAGER or bool(getattr(user, "is_staff", False))

        return _DispatchTarget(
            user_id=str(user.id),
            language=language,
            is_manager=is_manager,
            devices=devices,
        )

    @classmethod
    def _deliver(cls, target: _DispatchTarget, payload: PushPayload) -> None:
        web_devices = [d for d in target.devices if d.device_type == DeviceType.WEB]
        mobile_devices = [d for d in target.devices if d.device_type != DeviceType.WEB]

        if web_devices:
            cls._send_vapid_batch(web_devices, payload, target.language)
        if mobile_devices:
            cls._send_fcm_batch(mobile_devices, payload, target.language)

    # ------------------------------------------------------------------ #
    # VAPID (Web Push)                                                   #
    # ------------------------------------------------------------------ #

    @classmethod
    def _send_vapid_batch(
        cls,
        devices: list[PushDevice],
        payload: PushPayload,
        language: str,
    ) -> None:
        data = payload.to_dict()
        data["lang"] = language  # lets the SW set <notification lang> for a11y
        body = json.dumps(data, ensure_ascii=False)
        urgency = _VAPID_URGENCY.get(payload.level, "normal")
        ttl = _URGENT_TTL if payload.level == NotificationLevel.URGENT else _DEFAULT_TTL

        stale_ids: list[UUID] = []

        for device in devices:
            if not device.p256dh_key or not device.auth_key:
                logger.warning(
                    "[PushService] WEB device %s missing VAPID keys, skipping.",
                    device.id,
                )
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
            except WebPushException as exc:
                status_code = exc.response.status_code if exc.response is not None else None
                if status_code in _VAPID_STALE_STATUSES:
                    stale_ids.append(device.id)
                else:
                    logger.error(
                        "[PushService] VAPID send failed for device %s (status=%s): %s",
                        device.id, status_code, exc,
                    )

        if stale_ids:
            invalidated = PushDevice.objects.filter(id__in=stale_ids).update(is_active=False)
            logger.warning(
                "[PushService] Auto-invalidated %d stale Web Push subscriptions.",
                invalidated,
            )

    # ------------------------------------------------------------------ #
    # FCM (mobile)                                                       #
    # ------------------------------------------------------------------ #

    @classmethod
    def _send_fcm_batch(
        cls,
        devices: list[PushDevice],
        payload: PushPayload,
        language: str,
    ) -> None:
        tokens = [d.registration_token for d in devices]

        # Mirror the structured payload into FCM's `data` channel so the mobile
        # client can render the same UX (deep link, level styling, actions).
        data = {
            "type": payload.notification_type,
            "level": payload.level,
            "url": payload.url,
            "tag": payload.tag,
            "lang": language,
        }
        if payload.actions:
            data["actions"] = json.dumps(
                [
                    {"action": a.action, "title": a.title, **({"url": a.url} if a.url else {})}
                    for a in payload.actions
                ],
                ensure_ascii=False,
            )

        priority = "high" if payload.level in (NotificationLevel.URGENT, NotificationLevel.WARNING) else "normal"
        ttl_seconds = _URGENT_TTL if payload.level == NotificationLevel.URGENT else _DEFAULT_TTL

        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=payload.title, body=payload.body),
            data={k: str(v) for k, v in data.items()},
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority=priority,
                ttl=ttl_seconds,
                collapse_key=payload.tag[:64] if payload.tag else None,
            ),
            apns=messaging.APNSConfig(
                headers={
                    "apns-priority": "10" if priority == "high" else "5",
                    "apns-collapse-id": payload.tag[:64] if payload.tag else "",
                },
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=payload.title, body=payload.body),
                        sound="default",
                        thread_id=payload.notification_type,
                    ),
                ),
            ),
        )

        try:
            # send_each_for_multicast is the modern replacement for the
            # deprecated send_multicast batch endpoint (firebase-admin >= 6.2).
            response = messaging.send_each_for_multicast(message)
        except FirebaseError as exc:
            logger.error("[PushService] FCM multicast error: %s", exc, exc_info=True)
            raise

        if response.failure_count == 0:
            return

        stale_tokens: list[str] = []
        for idx, resp in enumerate(response.responses):
            if resp.success:
                continue
            code = getattr(getattr(resp, "exception", None), "code", "UNKNOWN")
            if code in _FCM_STALE_CODES:
                stale_tokens.append(tokens[idx])
            else:
                logger.error(
                    "[PushService] FCM send failed for token %s… (code=%s)",
                    tokens[idx][:12], code,
                )

        if stale_tokens:
            invalidated = PushDevice.objects.filter(
                registration_token__in=stale_tokens
            ).update(is_active=False)
            logger.warning(
                "[PushService] Auto-invalidated %d stale FCM tokens.", invalidated,
            )
