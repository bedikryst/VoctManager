# core/services.py
# ==========================================
# Core Business Logic (Service Layer)
# ==========================================
from django.contrib.auth import get_user_model
from django.db import transaction

from .models import UserProfile
from .dtos import UserPreferencesUpdateDTO, UserPasswordChangeDTO, UserEmailChangeDTO
from .exceptions import InvalidCredentialsException, EmailAlreadyInUseException

User = get_user_model()

def update_user_preferences(user: User, dto: UserPreferencesUpdateDTO) -> User:
    """Updates core user properties and associated preferences."""
    with transaction.atomic():
        user.first_name = dto.first_name
        user.last_name = dto.last_name
        user.save(update_fields=['first_name', 'last_name', 'updated_at'])

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                'phone_number': dto.phone_number or '',
                'language': dto.language,
                'timezone': dto.timezone
            }
        )
    return user


def change_user_password(user: User, dto: UserPasswordChangeDTO) -> None:
    """Securely updates the user's password after verifying the old one."""
    if not user.check_password(dto.old_password):
        raise InvalidCredentialsException("invalid_current_password")

    user.set_password(dto.new_password)
    user.save(update_fields=['password', 'updated_at'])


def process_email_change(user: User, dto: UserEmailChangeDTO) -> User:
    """
    Validates credentials and uniqueness before assigning a new email.
    In phase 2, this will generate a verification token instead of a direct update.
    """
    if not user.check_password(dto.current_password):
        raise InvalidCredentialsException("invalid_current_password")

    if User.objects.exclude(pk=user.pk).filter(email__iexact=dto.new_email).exists():
        raise EmailAlreadyInUseException("email_in_use")

    user.email = dto.new_email
    user.save(update_fields=['email', 'updated_at'])
    return user