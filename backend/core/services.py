# core/services.py
# ==========================================
# Core Domain Services
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
import uuid
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.translation import gettext as _
from django.utils.translation import override

from notifications.email_service import EmailType

# Enterprise Imports for Notifications
from notifications.email_tasks import send_transactional_email_task

from .dtos import (
    SUPPORTED_LANGUAGE_CODES,
    UserAccountDeletionDTO,
    UserEmailChangeDTO,
    UserPasswordChangeDTO,
    UserPreferencesUpdateDTO,
)
from .exceptions import EmailAlreadyInUseException, InvalidCredentialsException
from .models import UserProfile
from .signals import account_soft_deleted, user_email_changed, user_pii_updated

logger = logging.getLogger(__name__)

# `get_user_model()` returns a runtime value mypy cannot use as a type. Bind the
# concrete model under TYPE_CHECKING so annotations resolve, while keeping the
# dynamic swappable-model lookup at runtime.
if TYPE_CHECKING:
    from django.contrib.auth.models import User
else:
    User = get_user_model()


class UserIdentityService:
    """Enterprise service managing core authentication identity and account life-cycles."""

    @staticmethod
    def generate_activation_token_payload(user: User) -> dict[str, str]:
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return {"uidb64": uidb64, "token": token}

    @staticmethod
    def provision_user_account(email: str, first_name: str, last_name: str, language: str = 'pl', first_name_vocative: str = '', salutation: str = 'N') -> User:
        """
        Enterprise IAM: Provisions a new core identity and profile.
        Generates a collision-free UUID username, handles activation tokens,
        and explicitly dispatches the secure onboarding email.
        """
        if User.objects.filter(email__iexact=email).exists():
            raise EmailAlreadyInUseException("email_in_use")

        # The invited member's chosen language drives their activation email, the
        # activation screen itself and — until they change it — the whole app, so
        # guard that only a supported code is ever persisted or put on the link.
        language = language if language in SUPPORTED_LANGUAGE_CODES else 'pl'

        with transaction.atomic():
            # SaaS 2026 Standard: Abstract usernames prevent enumeration and PII leaks
            username = str(uuid.uuid4())

            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                is_active=False
            )
            user.set_unusable_password()
            user.save()

            # Explicit Profile Creation (side-effecting; the instance is not needed here)
            UserProfile.objects.create(
                user=user,
                language=language,
                salutation=salutation if salutation in {'F', 'M', 'N'} else 'N',
            )

            # Generate Activation Tokens
            payload = UserIdentityService.generate_activation_token_payload(user)
            activation_link = (
                f"{settings.CORS_ALLOWED_ORIGINS[0]}/activate"
                f"?uid={payload['uidb64']}&token={payload['token']}&lang={language}"
            )

            vocative = (first_name_vocative or first_name) if language == 'pl' else first_name

            # Dispatch Operational Email
            with override(language):
                translated_subject = str(_("Welcome to VoctManager - Activate Your Account"))
                
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject=translated_subject,
                    template_name="account_activation",
                    context={
                        "first_name": user.first_name,
                        "first_name_vocative": vocative,
                        "salutation": salutation if salutation in {'F', 'M', 'N'} else 'N',
                        "activation_link": activation_link,
                    },
                    fallback_language=language,
                    email_type=EmailType.OPERATIONAL
                )
            )

            logger.info(f"Core IAM identity provisioned and invite dispatched for: {email}")
            return user

    @staticmethod
    def get_activation_invitee(uidb64: str, token: str) -> dict[str, str]:
        """
        Read-only lookup of the invited member's display name (and chosen language)
        for a still-valid activation link, so the activation screen can greet them
        by name and render in their language before they set a password. Requires
        the signed token (which the invitee already holds), never consumes it, and
        mutates nothing.
        """
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.select_related("profile").get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise InvalidCredentialsException("invalid_activation_link")

        if not default_token_generator.check_token(user, token):
            raise InvalidCredentialsException("expired_activation_link")

        artist_profile = getattr(user, "artist_profile", None)
        vocative = getattr(artist_profile, "first_name_vocative", "") if artist_profile else ""
        profile = getattr(user, "profile", None)
        language = getattr(profile, "language", "") or "pl"
        return {
            "first_name": getattr(user, "first_name", "") or "",
            "first_name_vocative": vocative or "",
            # Authoritative confirmation of the link's ?lang= (server-side source).
            "language": language,
        }

    @staticmethod
    def activate_account_and_set_password(uidb64: str, token: str, new_password: str) -> User:
        """
        Activates the user account and explicitly dispatches a welcome email.
        """
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.select_related('profile').get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            logger.warning(f"Failed account activation attempt with invalid UID: {uidb64}")
            raise InvalidCredentialsException("invalid_activation_link")

        if not default_token_generator.check_token(user, token):
            logger.warning(f"Failed account activation attempt with expired/invalid token for user {user.email}")
            raise InvalidCredentialsException("expired_activation_link")

        with transaction.atomic():
            user.set_password(new_password)
            user.is_active = True
            user.save(update_fields=['password', 'is_active'])
            
            # Resolve fallback language safely
            fallback_lang = user.profile.language if hasattr(user, 'profile') else 'en'

            # Dispatch Welcome Email
            artist_profile = getattr(user, 'artist_profile', None)
            raw_vocative = getattr(artist_profile, 'first_name_vocative', '') if artist_profile else ''
            base_name = getattr(user, 'first_name', '')
            vocative = (raw_vocative or base_name) if fallback_lang == 'pl' else base_name
            
            with override(fallback_lang):
                translated_subject = str(_("Welcome to VoctManager"))
                
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject=translated_subject,
                    template_name="welcome_email",
                    context={
                        "first_name": getattr(user, "first_name", ""),
                        "first_name_vocative": vocative,
                        "salutation": getattr(getattr(user, "profile", None), "salutation", "N"),
                        "frontend_url": f"{settings.CORS_ALLOWED_ORIGINS[0]}/login",
                    },
                    fallback_language=fallback_lang,
                    email_type=EmailType.OPERATIONAL
                )
            )

            logger.info(f"Account successfully activated and welcome email queued for user: {user.email}")
            return user

    @staticmethod
    def request_password_reset(email: str) -> None:
        """
        Enumeration-safe public reset request. If an ACTIVE account exists for
        the e-mail, queue a signed reset link; otherwise do nothing. The caller
        must respond identically regardless, so existence is never revealed.

        Invited-but-not-yet-activated accounts (is_active=False) are skipped on
        purpose — their path is activation, not reset.
        """
        user = (
            User.objects.select_related("profile")
            .filter(email__iexact=email, is_active=True)
            .first()
        )
        if user is None:
            logger.info("Password reset requested for an unknown/inactive e-mail (no-op).")
            return

        payload = UserIdentityService.generate_activation_token_payload(user)
        reset_link = (
            f"{settings.CORS_ALLOWED_ORIGINS[0]}/reset-password"
            f"?uid={payload['uidb64']}&token={payload['token']}"
        )

        fallback_lang = user.profile.language if hasattr(user, "profile") else "en"
        artist_profile = getattr(user, "artist_profile", None)
        raw_vocative = getattr(artist_profile, "first_name_vocative", "") if artist_profile else ""
        base_name = getattr(user, "first_name", "")
        vocative = (raw_vocative or base_name) if fallback_lang == "pl" else base_name

        with override(fallback_lang):
            translated_subject = str(_("Reset your VoctManager password"))

        # No DB write here, so dispatch directly (no transaction to commit).
        send_transactional_email_task.delay(
            recipient_email=user.email,
            subject=translated_subject,
            template_name="password_reset",
            context={
                "first_name": base_name,
                "first_name_vocative": vocative,
                "salutation": getattr(getattr(user, "profile", None), "salutation", "N"),
                "reset_link": reset_link,
            },
            fallback_language=fallback_lang,
            email_type=EmailType.CRITICAL_SECURITY,
        )
        logger.info(f"Password reset link queued for user: {user.email}")

    @staticmethod
    def reset_password(uidb64: str, token: str, new_password: str) -> User:
        """
        Finalizes a password reset from a signed link. Mirrors account
        activation, but the account is already active and the password is
        merely rotated. The signed token (which hashes the current password)
        is single-use: setting the new password invalidates it.
        """
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.select_related("profile").get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            logger.warning(f"Failed password reset attempt with invalid UID: {uidb64}")
            raise InvalidCredentialsException("invalid_reset_link")

        if not user.is_active:
            # An invited-but-not-activated account must activate, not reset.
            logger.warning(f"Password reset attempted on an inactive account: {user.email}")
            raise InvalidCredentialsException("invalid_reset_link")

        if not default_token_generator.check_token(user, token):
            logger.warning(f"Failed password reset attempt with expired/invalid token for user {user.email}")
            raise InvalidCredentialsException("expired_reset_link")

        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=["password"])

            fallback_lang = user.profile.language if hasattr(user, "profile") else "en"
            with override(fallback_lang):
                translated_subject = str(_("Security Alert: Password Changed"))

            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject=translated_subject,
                    template_name="password_changed",
                    context={"user_email": user.email},
                    fallback_language=fallback_lang,
                    email_type=EmailType.CRITICAL_SECURITY,
                )
            )

        logger.info(f"Password successfully reset and security alert queued for user: {user.email}")
        return user

    @staticmethod
    def change_user_password(user: User, dto: UserPasswordChangeDTO) -> None:
        """
        Changes user password and explicitly dispatches a critical security alert.
        """
        if not user.check_password(dto.old_password):
            logger.warning(f"Failed password change attempt (invalid password) for user: {user.email}")
            raise InvalidCredentialsException("invalid_current_password")

        with transaction.atomic():
            user.set_password(dto.new_password)
            user.save()
            
            # Dispatch Security Alert
            fallback_lang = user.profile.language if hasattr(user, 'profile') else 'en'
            with override(fallback_lang):
                translated_subject = str(_("Security Alert: Password Changed"))
                
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject=translated_subject,
                    template_name="password_changed",
                    context={"user_email": user.email},
                    fallback_language=fallback_lang,
                    email_type=EmailType.CRITICAL_SECURITY
                )
            )
            logger.info(f"Password successfully changed and security alert queued for user: {user.email}")

    @staticmethod
    def process_email_change(user: User, dto: UserEmailChangeDTO) -> User:
        if not user.check_password(dto.current_password):
            logger.warning(f"Failed email change attempt (invalid password) for user: {user.email}")
            raise InvalidCredentialsException("invalid_current_password")

        if User.objects.exclude(pk=user.pk).filter(email__iexact=dto.new_email).exists():
            logger.warning(f"Email change conflict: {dto.new_email} is already taken.")
            raise EmailAlreadyInUseException("email_in_use")

        old_email = user.email
        user.email = dto.new_email
        user.save(update_fields=['email'])

        # A fresh address is deliverable until proven otherwise — clear any prior
        # bounce/complaint suppression so the new mailbox starts receiving again.
        UserProfile.objects.filter(user=user, email_undeliverable=True).update(email_undeliverable=False)

        user_email_changed.send(sender=UserIdentityService, user=user, old_email=old_email, new_email=dto.new_email)
        logger.info(f"Email changed successfully from {old_email} to {dto.new_email}")
        return user

    @staticmethod
    def process_account_soft_deletion(user: User, dto: UserAccountDeletionDTO) -> None:
        """
        Executes GDPR Right to Erasure (Soft Delete).
        Anonymizes PII data to free up the email for future registration,
        deactivates the account, and emits a domain event for dependent contexts.
        """
        if not user.check_password(dto.current_password):
            logger.warning(f"Failed account deletion attempt (invalid password) for user: {user.email}")
            raise InvalidCredentialsException("invalid_current_password")
        
        original_email = user.email
        fallback_lang = user.profile.language if hasattr(user, 'profile') else 'en'

        with transaction.atomic():
            # 1. GDPR Anonymization (Freeing up unique constraints)
            anonymized_id = str(user.id)
            user.email = f"deleted_{anonymized_id}@anonymized.local"
            user.username = anonymized_id
            user.first_name = "Deleted"
            user.last_name = "User"
            user.is_active = False  
            user.save(update_fields=['email', 'username', 'first_name', 'last_name', 'is_active'])
            
            # 2. Delete Core Preferences entirely
            if hasattr(user, 'profile'):
                user.profile.delete() 
                
            # 3. Emit Domain Event (Handled by Roster to soft-delete Artist)
            account_soft_deleted.send(sender=UserIdentityService, user=user)
            
            # 4. Dispatch confirmation email (using the original email we stored)
            with override(fallback_lang):
                translated_subject = str(_("Your VoctManager Account has been successfully deleted"))
                
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=original_email,
                    subject=translated_subject,
                    template_name="account_deleted",
                    context={"user_email": original_email},
                    fallback_language=fallback_lang,
                    email_type=EmailType.CRITICAL_SECURITY
                )
            )
            
        logger.info(f"Account soft-deleted and GDPR-anonymized for user ID: {anonymized_id}")
        
class UserPreferencesService:
    """Service managing application-specific user configurations and GDPR exports."""

    @staticmethod
    def update_user_preferences(user: User, dto: UserPreferencesUpdateDTO) -> User:
        with transaction.atomic():
            user.first_name = dto.first_name
            user.last_name = dto.last_name
            user.save(update_fields=['first_name', 'last_name'])

            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    'phone_number': dto.phone_number or '',
                    'language': dto.language,
                    'timezone': dto.timezone,
                    'salutation': dto.salutation,
                    'dietary_preference': dto.dietary_preference,
                    'dietary_notes': dto.dietary_notes,
                    'clothing_size': dto.clothing_size,
                    'shoe_size': dto.shoe_size,
                    'height_cm': dto.height_cm,
                }
            )

            user_pii_updated.send(sender=UserPreferencesService, user=user, dto=dto)
            
            logger.info(f"User preferences synchronized for: {user.email}")
            return user

    @staticmethod
    def reset_calendar_token(user: User) -> UserProfile:
        """Regenerates the secret token, instantly invalidating the old calendar URL."""
        profile = user.profile
        profile.calendar_token = uuid.uuid4()
        profile.save(update_fields=['calendar_token', 'updated_at'])
        logger.info(f"Calendar token reset for user: {user.email}")
        return profile

    @staticmethod
    def generate_gdpr_export(user: User, profile_data: dict) -> dict[str, Any]:
        """
        Compiles user data for GDPR Right to Data Portability. 
        Requires pre-serialized profile data to avoid circular dependencies with Views.
        """
        data = {
            "generated_at": timezone.now().isoformat(),
            "app_name": "VoctManager Enterprise 2026",
            "account": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "date_joined": user.date_joined.isoformat(),
            },
            "preferences": profile_data,
            "artist_profile": None
        }

        # Safe Export - explicitly exclude managerial metrics
        if hasattr(user, 'artist_profile'):
            artist = user.artist_profile
            data["artist_profile"] = {
                "voice_type": artist.get_voice_type_display(),
                "phone_number": artist.phone_number,
            }
        return data