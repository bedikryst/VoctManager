# core/dtos.py
# ==========================================
# Core Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .constants import ClothingSizeChoices, DietaryChoices

SUPPORTED_LANGUAGE_CODES = frozenset({"en", "pl", "fr"})
DIETARY_CHOICE_VALUES = frozenset(DietaryChoices.values)
CLOTHING_SIZE_VALUES = frozenset(ClothingSizeChoices.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value

class EnterpriseBaseDTO(BaseModel):
    """
    Base DTO enforcing immutability and rejecting undefined fields.
    Prevents API payload pollution (Mass Assignment Vulnerabilities).
    """
    model_config = ConfigDict(frozen=True, extra='forbid')


class UserPreferencesUpdateDTO(EnterpriseBaseDTO):
    first_name: str = Field(..., min_length=1, max_length=150)
    last_name: str = Field(..., min_length=1, max_length=150)
    phone_number: str | None = Field(None, max_length=32)
    language: str = Field(default='en', max_length=10)
    timezone: str = Field(default='Europe/Warsaw', max_length=63)
    
    dietary_preference: str = Field(default='none', max_length=15)
    dietary_notes: str = Field(default='')
    clothing_size: str = Field(default='', max_length=5)
    shoe_size: str = Field(default='', max_length=10)
    # Automatically validates that height is physically realistic
    height_cm: int | None = Field(None, ge=100, le=250)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _require_choice(value, SUPPORTED_LANGUAGE_CODES, "language")

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be a valid IANA timezone name.") from exc
        return value

    @field_validator("dietary_preference")
    @classmethod
    def validate_dietary_preference(cls, value: str) -> str:
        return _require_choice(value, DIETARY_CHOICE_VALUES, "dietary_preference")

    @field_validator("clothing_size")
    @classmethod
    def validate_clothing_size(cls, value: str) -> str:
        if value == "":
            return value
        return _require_choice(value, CLOTHING_SIZE_VALUES, "clothing_size")


class UserPasswordChangeDTO(EnterpriseBaseDTO):
    old_password: str = Field(..., min_length=1)
    # Enterprise standard: passwords must be at least 8 characters
    new_password: str = Field(..., min_length=8) 


class UserAccountActivationDTO(EnterpriseBaseDTO):
    uidb64: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class UserEmailChangeDTO(EnterpriseBaseDTO):
    # EmailStr automatically validates regex and domain structures
    new_email: EmailStr
    current_password: str = Field(..., min_length=1)


class UserAccountDeletionDTO(EnterpriseBaseDTO):
    """Data contract enforcing re-authentication before account erasure."""
    current_password: str = Field(..., min_length=1)
