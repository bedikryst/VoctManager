# core/dtos.py
# ==========================================
# Core Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional

class EnterpriseBaseDTO(BaseModel):
    """
    Base DTO enforcing immutability and rejecting undefined fields.
    Prevents API payload pollution (Mass Assignment Vulnerabilities).
    """
    model_config = ConfigDict(frozen=True, extra='forbid')


class UserPreferencesUpdateDTO(EnterpriseBaseDTO):
    first_name: str = Field(..., min_length=1, max_length=150)
    last_name: str = Field(..., min_length=1, max_length=150)
    phone_number: Optional[str] = Field(None, max_length=32)
    language: str = Field(default='en', max_length=10)
    timezone: str = Field(default='UTC', max_length=63)
    
    dietary_preference: str = Field(default='none', max_length=15)
    dietary_notes: str = Field(default='')
    clothing_size: str = Field(default='', max_length=5)
    shoe_size: str = Field(default='', max_length=10)
    # Automatically validates that height is physically realistic
    height_cm: Optional[int] = Field(None, ge=100, le=250)


class UserPasswordChangeDTO(EnterpriseBaseDTO):
    old_password: str = Field(..., min_length=1)
    # Enterprise standard: passwords must be at least 8 characters
    new_password: str = Field(..., min_length=8) 


class UserEmailChangeDTO(EnterpriseBaseDTO):
    # EmailStr automatically validates regex and domain structures
    new_email: EmailStr
    current_password: str = Field(..., min_length=1)


class UserAccountDeletionDTO(EnterpriseBaseDTO):
    """Data contract enforcing re-authentication before account erasure."""
    current_password: str = Field(..., min_length=1)