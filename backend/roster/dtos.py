# roster/dtos.py
# ==========================================
# Roster Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, Union
from uuid import UUID
from decimal import Decimal
from datetime import datetime

class EnterpriseBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')


class ArtistCreateDTO(EnterpriseBaseDTO):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    voice_type: str = Field(..., min_length=2, max_length=5)
    phone_number: Optional[str] = Field(None, max_length=15)
    sight_reading_skill: Optional[int] = Field(None, ge=1, le=5)
    vocal_range_bottom: Optional[str] = Field(None, max_length=5)
    vocal_range_top: Optional[str] = Field(None, max_length=5)
    language: str = Field(default='en', max_length=10)


class AttendanceRecordDTO(EnterpriseBaseDTO):
    requesting_user_id: Union[int, str] 
    is_manager: bool = False
    participation_id: UUID = Field(alias="participation")
    rehearsal_id: UUID = Field(alias="rehearsal")
    status: str = Field(..., min_length=1, max_length=10)
    minutes_late: Optional[int] = Field(None, ge=0)
    excuse_note: str = Field(default='', max_length=255)


class ProjectBulkFeeDTO(EnterpriseBaseDTO):
    project_id: UUID
    new_fee: Decimal = Field(..., ge=0, max_digits=8, decimal_places=2)


class ProjectCreateDTO(EnterpriseBaseDTO):
    """Data contract for creating a new project."""
    title: str = Field(..., min_length=1, max_length=200)
    date_time: datetime
    timezone: str = 'Europe/Warsaw'
    call_time: Optional[datetime] = None
    conductor: Optional[UUID] = None
    location_id: Optional[UUID] = None
    description: str = Field(default='')
    dress_code_male: str = Field(default='', max_length=100)
    dress_code_female: str = Field(default='', max_length=100)
    status: str = Field(default='DRAFT', max_length=10)
    spotify_playlist_url: Optional[str] = None
    run_sheet: list = Field(default_factory=list)


class ProjectUpdateDTO(EnterpriseBaseDTO):
    """Data contract for partial or full updates of a project."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    date_time: Optional[datetime] = None
    timezone: Optional[str] = None
    call_time: Optional[datetime] = None
    conductor: Optional[UUID] = None
    location_id: Optional[UUID] = None
    description: Optional[str] = None
    dress_code_male: Optional[str] = Field(None, max_length=100)
    dress_code_female: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=10)
    spotify_playlist_url: Optional[str] = None
    run_sheet: Optional[list] = None


class RehearsalCreateDTO(EnterpriseBaseDTO):
    """Data contract for scheduling a new rehearsal."""
    project_id: UUID
    date_time: datetime
    timezone: str = 'Europe/Warsaw'
    location_id: Optional[UUID] = None
    focus: str = Field(default='', max_length=255)
    is_mandatory: bool = True


class RehearsalUpdateDTO(EnterpriseBaseDTO):
    """Data contract for updating an existing rehearsal."""
    date_time: Optional[datetime] = None
    timezone: Optional[str] = None
    location_id: Optional[UUID] = None
    focus: Optional[str] = Field(None, max_length=255)
    is_mandatory: Optional[bool] = None
