# core/dtos.py
# ==========================================
# Core Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .constants import ClothingSizeChoices

SUPPORTED_LANGUAGE_CODES = frozenset({"en", "pl", "fr"})
SALUTATION_VALUES = frozenset({"F", "M", "N"})
CLOTHING_SIZE_VALUES = frozenset(ClothingSizeChoices.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value


def _strip_required_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if not stripped:
        raise ValueError("Value cannot be blank.")
    return stripped


def _blank_to_none(value: object) -> object:
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    return stripped or None


def _blank_to_empty(value: object) -> object:
    if value is None:
        return ""
    if not isinstance(value, str):
        return value
    return value.strip()


class EnterpriseBaseDTO(BaseModel):
    """
    Base DTO enforcing immutability and rejecting undefined fields.
    Prevents API payload pollution (Mass Assignment Vulnerabilities).
    """
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)


class UserPreferencesUpdateDTO(EnterpriseBaseDTO):
    first_name: str = Field(..., min_length=1, max_length=150)
    last_name: str = Field(..., min_length=1, max_length=150)
    phone_number: str | None = Field(None, max_length=32)
    language: str = Field(default='en', max_length=10)
    timezone: str = Field(default='Europe/Warsaw', max_length=63)
    salutation: str = Field(default='N', max_length=1)

    clothing_size: str = Field(default='', max_length=5)
    shoe_size: str = Field(default='', max_length=10)
    # Automatically validates that height is physically realistic
    height_cm: int | None = Field(None, ge=100, le=250)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> object:
        return _strip_required_text(value)

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalize_phone_number(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("clothing_size", "shoe_size", mode="before")
    @classmethod
    def normalize_blankable_text(cls, value: object) -> object:
        return _blank_to_empty(value)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        value = value.lower()
        return _require_choice(value, SUPPORTED_LANGUAGE_CODES, "language")

    @field_validator("salutation")
    @classmethod
    def validate_salutation(cls, value: str) -> str:
        value = (value or "N").upper()
        return _require_choice(value, SALUTATION_VALUES, "salutation")

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be a valid IANA timezone name.") from exc
        return value

    @field_validator("clothing_size")
    @classmethod
    def validate_clothing_size(cls, value: str) -> str:
        value = value.lower()
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
    # Version of the Terms/Privacy documents displayed and accepted on the
    # activation screen. Mandatory: acceptance is a condition of activation and
    # the (version, timestamp) pair is stored as legal evidence.
    terms_version: str = Field(..., min_length=1, max_length=20)


class UserPasswordResetRequestDTO(EnterpriseBaseDTO):
    """Public, enumeration-safe reset request — only an e-mail is accepted."""
    # EmailStr automatically validates regex and domain structures
    email: EmailStr


class UserPasswordResetConfirmDTO(EnterpriseBaseDTO):
    """Finalizes a reset from a signed link. Mirrors activation's contract."""
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
