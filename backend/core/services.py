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
    """
    Updates core user properties and synchronizes them across all linked profiles
    (UserProfile and Artist) to maintain data integrity.
    """
    with transaction.atomic():
        # 1. Update Core User 
        # (CRITICAL FIX: Django's default User model does NOT have an 'updated_at' field)
        user.first_name = dto.first_name
        user.last_name = dto.last_name
        user.save(update_fields=['first_name', 'last_name'])

        # 2. Update/Create System Preferences (Core Profile)
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

        # 3. Synchronize with Artist Profile (Roster Domain)
        if hasattr(user, 'artist_profile'):
            artist = user.artist_profile
            artist.first_name = dto.first_name
            artist.last_name = dto.last_name
            if dto.phone_number:
                artist.phone_number = dto.phone_number
            
            # Enterprise safeguard: Check if the model actually supports updated_at
            fields_to_update = ['first_name', 'last_name', 'phone_number']
            if hasattr(artist, 'updated_at'):
                from django.utils import timezone
                artist.updated_at = timezone.now()
                fields_to_update.append('updated_at')
                
            artist.save(update_fields=fields_to_update)

    return user


def change_user_password(user: User, dto: UserPasswordChangeDTO) -> None:
    """Securely updates the user's password."""
    if not user.check_password(dto.old_password):
        raise InvalidCredentialsException("invalid_current_password")

    user.set_password(dto.new_password)
    # Important: We save the whole object to ensure all signals and password hashing are final
    user.save()


def process_email_change(user: User, dto: UserEmailChangeDTO) -> User:
    """
    Validates credentials and uniqueness before assigning a new email.
    """
    if not user.check_password(dto.current_password):
        raise InvalidCredentialsException("invalid_current_password")

    if User.objects.exclude(pk=user.pk).filter(email__iexact=dto.new_email).exists():
        raise EmailAlreadyInUseException("email_in_use")

    user.email = dto.new_email
    user.save(update_fields=['email'])
    return user