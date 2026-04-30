"""
@file push_service.py
@description Dual-channel push dispatch: VAPID (Web Push) for browsers,
             FCM (Firebase) for iOS/Android native apps.
@architecture Enterprise SaaS 2026
@module notifications/push_service
"""
import json
import logging
from typing import Dict, Any, List

from django.conf import settings
from django.utils import translation
from django.contrib.auth import get_user_model

from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from pywebpush import webpush, WebPushException

from .models import PushDevice, DeviceType
from .dtos import PushDeviceRegisterDTO, WebPushSubscribeDTO

logger = logging.getLogger(__name__)
User = get_user_model()

_VAPID_CLAIMS = {"sub": f"mailto:{getattr(settings, 'VAPID_CONTACT_EMAIL', 'noreply@voct.pl')}"}


class PushDispatcherService:
    """
    Enterprise push notification dispatcher.
    Routes to VAPID (web) or FCM (mobile) based on device type.
    """

    @classmethod
    def dispatch_to_user(
        cls,
        recipient_id: str,
        title_key: str,
        body_key: str,
        metadata: Dict[str, Any],
    ) -> None:
        try:
            user = User.objects.select_related('profile').get(id=recipient_id)
            devices = PushDevice.objects.filter(user=user, is_active=True)
            if not devices.exists():
                return

            lang = getattr(user.profile, 'language', 'en')
            with translation.override(lang):
                title = translation.gettext(title_key)
                body = translation.gettext(body_key)

            web_devices = [d for d in devices if d.device_type == DeviceType.WEB]
            mobile_devices = [d for d in devices if d.device_type != DeviceType.WEB]

            if web_devices:
                cls._send_vapid_batch(web_devices, title, body, metadata)
            if mobile_devices:
                tokens = [d.registration_token for d in mobile_devices]
                cls._send_fcm_batch(tokens, title, body, metadata)

        except Exception as e:
            logger.error(f"[PushService] Dispatch failed for UID:{recipient_id}: {e}", exc_info=True)

    @classmethod
    def _send_vapid_batch(
        cls,
        devices: List[PushDevice],
        title: str,
        body: str,
        metadata: Dict[str, Any],
    ) -> None:
        payload = json.dumps({"title": title, "body": body, **metadata})
        stale_ids: List[int] = []

        for device in devices:
            if not device.p256dh_key or not device.auth_key:
                logger.warning(f"[PushService] WEB device {device.id} missing VAPID keys, skipping.")
                continue
            try:
                webpush(
                    subscription_info={
                        "endpoint": device.registration_token,
                        "keys": {"p256dh": device.p256dh_key, "auth": device.auth_key},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims=_VAPID_CLAIMS,
                )
            except WebPushException as e:
                status_code = e.response.status_code if e.response is not None else None
                # 404 / 410 = subscription expired or revoked by browser
                if status_code in (404, 410):
                    stale_ids.append(device.id)
                else:
                    logger.error(f"[PushService] VAPID send failed for device {device.id}: {e}")

        if stale_ids:
            invalidated = PushDevice.objects.filter(id__in=stale_ids).update(is_active=False)
            logger.warning(f"[PushService] Auto-invalidated {invalidated} stale Web Push subscriptions.")

    @classmethod
    def _send_fcm_batch(
        cls,
        tokens: List[str],
        title: str,
        body: str,
        metadata: Dict[str, Any],
    ) -> None:
        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in metadata.items()},
                tokens=tokens,
            )
            response = messaging.send_multicast(message)

            if response.failure_count > 0:
                stale_tokens: List[str] = []
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        code = resp.exception.code if resp.exception else "UNKNOWN"
                        if code in ('UNREGISTERED', 'SENDER_ID_MISMATCH', 'INVALID_ARGUMENT'):
                            stale_tokens.append(tokens[idx])
                if stale_tokens:
                    invalidated = PushDevice.objects.filter(
                        registration_token__in=stale_tokens
                    ).update(is_active=False)
                    logger.warning(f"[PushService] Auto-invalidated {invalidated} stale FCM tokens.")

        except FirebaseError as e:
            logger.error(f"[PushService] FCM multicast error: {e}", exc_info=True)
            raise

    @classmethod
    def register_web_push(cls, dto: WebPushSubscribeDTO) -> None:
        """Registers or refreshes a browser Web Push (VAPID) subscription."""
        PushDevice.objects.update_or_create(
            registration_token=dto.endpoint,
            defaults={
                'user_id': dto.user_id,
                'device_type': DeviceType.WEB,
                'p256dh_key': dto.p256dh_key,
                'auth_key': dto.auth_key,
                'is_active': True,
                'is_deleted': False,
            },
        )
        logger.info(f"[PushService] Web Push subscription registered for UID:{dto.user_id}")

    @classmethod
    def register_device(cls, dto: PushDeviceRegisterDTO) -> None:
        """Registers or reactivates a FCM push token (iOS / Android)."""
        PushDevice.objects.update_or_create(
            registration_token=dto.registration_token,
            defaults={
                'user_id': dto.user_id,
                'device_type': dto.device_type,
                'is_active': True,
                'is_deleted': False,
            },
        )
        logger.info(f"[PushService] FCM device token registered for UID:{dto.user_id}")

    @classmethod
    def unregister_device(cls, user_id: str, token: str) -> None:
        """Hard-deletes a push subscription/token (called on logout or explicit unsubscribe)."""
        deleted_count, _ = PushDevice.objects.filter(
            user_id=user_id,
            registration_token=token,
        ).delete()
        if deleted_count > 0:
            logger.info(f"[PushService] Push subscription unregistered for UID:{user_id}")

    @classmethod
    def send_test_push(cls, user) -> int:
        """
        Dispatches a synchronous test push to every active device of the user.
        Returns the number of devices the message was attempted on (stale ones
        are auto-invalidated by the underlying batch senders).
        """
        devices = list(PushDevice.objects.filter(user=user, is_active=True))
        if not devices:
            return 0

        title = "VoctManager — test powiadomień"
        body = "Powiadomienia push są aktywne. Wszystko działa jak należy."
        metadata: Dict[str, Any] = {
            "url": "/panel/settings?tab=notifications",
            "tag": "voct-test-push",
            "renotify": True,
        }

        web_devices = [d for d in devices if d.device_type == DeviceType.WEB]
        mobile_devices = [d for d in devices if d.device_type != DeviceType.WEB]

        if web_devices:
            cls._send_vapid_batch(web_devices, title, body, metadata)
        if mobile_devices:
            tokens = [d.registration_token for d in mobile_devices]
            cls._send_fcm_batch(tokens, title, body, metadata)

        logger.info(f"[PushService] Test push dispatched to {len(devices)} device(s) for UID:{user.id}")
        return len(devices)
