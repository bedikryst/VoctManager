# core/dtos.py
# ==========================================
# Core Data Transfer Objects (DTOs)
# ==========================================
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class UserPreferencesUpdateDTO:
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    language: str = 'en'
    timezone: str = 'UTC'

    dietary_preference: str = 'none'
    dietary_notes: str = ''
    clothing_size: str = ''
    shoe_size: str = ''
    height_cm: Optional[int] = None

@dataclass(frozen=True)
class UserPasswordChangeDTO:
    old_password: str
    new_password: str

@dataclass(frozen=True)
class UserEmailChangeDTO:
    new_email: str
    current_password: str