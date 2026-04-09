# roster/dtos.py
# ==========================================
# Roster Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, Union
from uuid import UUID
from decimal import Decimal

class EnterpriseBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')


class ArtistCreateDTO(EnterpriseBaseDTO):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    voice_type: str = Field(..., min_length=2, max_length=5)
    phone_number: Optional[str] = Field(None, max_length=15)
    
    # Business logic constraints at the boundary level
    sight_reading_skill: Optional[int] = Field(None, ge=1, le=5)
    vocal_range_bottom: Optional[str] = Field(None, max_length=5)
    vocal_range_top: Optional[str] = Field(None, max_length=5)


class AttendanceRecordDTO(EnterpriseBaseDTO):
    # Added missing fields that the Service layer expects!
    # Accepts string or int for flexibility with Django's default User Model (which uses int PKs)
    requesting_user_id: Union[int, str] 
    is_superuser: bool = False
    
    # Using UUID type automatically validates the string format
    participation_id: UUID
    rehearsal_id: UUID
    
    status: str = Field(..., min_length=1, max_length=10)
    minutes_late: Optional[int] = Field(None, ge=0)
    excuse_note: str = Field(default='', max_length=255)


class ProjectBulkFeeDTO(EnterpriseBaseDTO):
    project_id: UUID
    # Enforces decimal precision and prevents negative payouts
    new_fee: Decimal = Field(..., ge=0, max_digits=8, decimal_places=2)


class ParticipationRestoreDTO(EnterpriseBaseDTO):
    artist_id: UUID
    project_id: UUID