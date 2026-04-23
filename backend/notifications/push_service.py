import logging
from typing import Dict, Any, List
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from django.utils import translation
from django.contrib.auth import get_user_model
from .models import PushDevice
from .dtos import PushDeviceRegisterDTO

logger = logging.getLogger(__name__)
User = get_user_model()

class PushDispatcherService:
    """
    Enterprise service for localized Push notification delivery via FCM.
    """

    @classmethod
    def dispatch_to_user(
        cls,
        recipient_id: str,
        title_key: str,
        body_key: str,
        metadata: Dict[str, Any]
    ) -> None:
        """
        Resolves active devices and dispatches localized payloads.
        """
        try:
            user = User.objects.select_related('profile').get(id=recipient_id)
            devices = PushDevice.objects.filter(user=user, is_active=True)
            
            if not devices.exists():
                return

            lang = getattr(user.profile, 'language', 'en')
            
            with translation.override(lang):
                title = translation.gettext(title_key)
                body = translation.gettext(body_key)

                tokens = [d.registration_token for d in devices]
                cls._send_fcm_batch(tokens, title, body, metadata)

        except Exception as e:
            logger.error(f"[PushService] Dispatch failed for UID:{recipient_id}: {e}", exc_info=True)

    @classmethod
    def _send_fcm_batch(cls, tokens: List[str], title: str, body: str, metadata: Dict[str, Any]) -> None:
        """
        Transmits payload via FCM and processes the BatchResponse to automatically
        invalidate unregistered or expired device tokens.
        """
        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in metadata.items()},
                tokens=tokens,
            )
            response = messaging.send_multicast(message)
            
            if response.failure_count > 0:
                failed_tokens = []
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        error_code = resp.exception.code if resp.exception else "UNKNOWN"
                        if error_code in ['UNREGISTERED', 'SENDER_ID_MISMATCH', 'INVALID_ARGUMENT']:
                            failed_tokens.append(tokens[idx])
                
                if failed_tokens:
                    invalidated_count = PushDevice.objects.filter(
                        registration_token__in=failed_tokens
                    ).update(is_active=False)
                    logger.warning(f"[PushService] Auto-invalidated {invalidated_count} stale Push tokens.")

        except FirebaseError as e:
            logger.error(f"[PushService] Fatal FCM infrastructure error during multicast: {e}", exc_info=True)
            raise

    @classmethod
    def register_device(cls, dto: PushDeviceRegisterDTO) -> None:
        """
        Registers or reactivates a push notification token for the user.
        Updates device_type if the same token is re-registered under a different platform.
        """
        PushDevice.objects.update_or_create(
            registration_token=dto.registration_token,
            defaults={
                'user_id': dto.user_id,
                'device_type': dto.device_type,
                'is_active': True,
                'is_deleted': False
            }
        )
        logger.info(f"[PushService] Device token registered for UID:{dto.user_id}")

    @classmethod
    def unregister_device(cls, user_id: str, token: str) -> None:
        """
        Hard or soft deletes the device token explicitly requested by the client (e.g., on logout).
        """
        deleted_count, _ = PushDevice.objects.filter(
            user_id=user_id,
            registration_token=token
        ).delete()
        
        if deleted_count > 0:
            logger.info(f"[PushService] Device token unregistered for UID:{user_id}")