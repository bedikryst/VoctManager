# core/services.py
# ==========================================
# Core Domain Services
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
import uuid
from typing import Optional, Dict, Any
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from .signals import account_soft_deleted, user_email_changed, user_pii_updated

from .models import UserProfile
from .dtos import UserPreferencesUpdateDTO, UserPasswordChangeDTO, UserEmailChangeDTO, UserAccountDeletionDTO
from .exceptions import InvalidCredentialsException, EmailAlreadyInUseException

# Enterprise Imports for Notifications
from notifications.email_tasks import send_transactional_email_task
from notifications.email_service import EmailType

logger = logging.getLogger(__name__)
User = get_user_model()


class UserIdentityService:
    """Enterprise service managing core authentication identity and account life-cycles."""

    @staticmethod
    def generate_activation_token_payload(user: User) -> dict[str, str]:
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return {"uidb64": uidb64, "token": token}

    @staticmethod
    def provision_user_account(email: str, first_name: str, last_name: str, language: str = 'en', first_name_vocative: str = '') -> User:
        """
        Enterprise IAM: Provisions a new core identity and profile.
        Generates a collision-free UUID username, handles activation tokens,
        and explicitly dispatches the secure onboarding email.
        """
        if User.objects.filter(email__iexact=email).exists():
            raise EmailAlreadyInUseException("email_in_use")

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

            # Explicit Profile Creation
            profile = UserProfile.objects.create(
                user=user,
                language=language
            )

            # Generate Activation Tokens
            payload = UserIdentityService.generate_activation_token_payload(user)
            activation_link = (
                f"{settings.CORS_ALLOWED_ORIGINS[0]}/activate"
                f"?uid={payload['uidb64']}&token={payload['token']}"
            )

            vocative = (first_name_vocative or first_name) if language == 'pl' else first_name

            # Dispatch Operational Email
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject="Welcome to VoctManager - Activate Your Account",
                    template_name="account_activation",
                    context={
                        "first_name": user.first_name,
                        "first_name_vocative": vocative,
                        "activation_link": activation_link,
                    },
                    fallback_language=language,
                    email_type=EmailType.OPERATIONAL
                )
            )

            logger.info(f"Core IAM identity provisioned and invite dispatched for: {email}")
            return user

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
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject="Welcome to VoctManager",
                    template_name="welcome_email",
                    context={
                        "first_name": getattr(user, "first_name", ""),
                        "first_name_vocative": vocative,
                        "frontend_url": f"{settings.CORS_ALLOWED_ORIGINS[0]}/login",
                    },
                    fallback_language=fallback_lang,
                    email_type=EmailType.OPERATIONAL
                )
            )

            logger.info(f"Account successfully activated and welcome email queued for user: {user.email}")
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
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject="Security Alert: Password Changed",
                    template_name="password_changed",
                    context={"user_email": user.email},
                    fallback_language='en', # Dispatcher resolves correct language via DB
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
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=original_email,
                    subject="Your VoctManager Account has been successfully deleted",
                    template_name="account_deleted",
                    context={"user_email": original_email},
                    fallback_language='en',
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
    def generate_gdpr_export(user: User, profile_data: dict) -> Dict[str, Any]:
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