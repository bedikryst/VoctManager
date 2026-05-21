# roster/dtos.py
# ==========================================
# Roster Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .models import Attendance, Participation, Project, VoiceType

SUPPORTED_LANGUAGE_CODES = frozenset({"en", "pl", "fr"})
ATTENDANCE_STATUS_VALUES = frozenset(Attendance.Status.values)
PROJECT_STATUS_VALUES = frozenset(Project.Status.values)
PARTICIPATION_STATUS_VALUES = frozenset(Participation.Status.values)
VOICE_TYPE_VALUES = frozenset(VoiceType.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("timezone must be a valid IANA timezone name.") from exc
    return value


def _blankable_string(value: str | None) -> str:
    return "" if value is None else value

class EnterpriseBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')


class ArtistCreateDTO(EnterpriseBaseDTO):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    first_name_vocative: str | None = Field(None, max_length=50)
    email: EmailStr
    voice_type: str = Field(..., min_length=2, max_length=5)
    phone_number: str | None = Field(None, max_length=15)
    sight_reading_skill: int | None = Field(None, ge=1, le=5)
    vocal_range_bottom: str | None = Field(None, max_length=5)
    vocal_range_top: str | None = Field(None, max_length=5)
    language: str = Field(default='en', max_length=10)

    @field_validator("voice_type")
    @classmethod
    def validate_voice_type(cls, value: str) -> str:
        return _require_choice(value, VOICE_TYPE_VALUES, "voice_type")

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _require_choice(value, SUPPORTED_LANGUAGE_CODES, "language")


class AttendanceRecordDTO(EnterpriseBaseDTO):
    requesting_user_id: int | str 
    is_manager: bool = False
    participation_id: UUID = Field(alias="participation")
    rehearsal_id: UUID = Field(alias="rehearsal")
    status: str = Field(..., min_length=1, max_length=10)
    minutes_late: int | None = Field(None, ge=0)
    excuse_note: str = Field(default='', max_length=255)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _require_choice(value, ATTENDANCE_STATUS_VALUES, "status")


class ParticipationStatusUpdateDTO(EnterpriseBaseDTO):
    """Data contract for artist or manager participation status changes."""

    status: str = Field(..., max_length=3)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _require_choice(value, PARTICIPATION_STATUS_VALUES, "status")


class ProjectBulkFeeDTO(EnterpriseBaseDTO):
    project_id: UUID
    new_fee: Decimal = Field(..., ge=0, max_digits=8, decimal_places=2)


class ProjectCreateDTO(EnterpriseBaseDTO):
    """Data contract for creating a new project."""
    title: str = Field(..., min_length=1, max_length=200)
    date_time: datetime
    timezone: str = 'Europe/Warsaw'
    call_time: datetime | None = None
    conductor: UUID | None = None
    location_id: UUID | None = None
    description: str = Field(default='')
    dress_code_male: str = Field(default='', max_length=100)
    dress_code_female: str = Field(default='', max_length=100)
    status: str = Field(default='DRAFT', max_length=10)
    spotify_playlist_url: str = Field(default='', max_length=500)
    run_sheet: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        return _validate_timezone(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _require_choice(value, PROJECT_STATUS_VALUES, "status")

    @field_validator(
        "description",
        "dress_code_male",
        "dress_code_female",
        "spotify_playlist_url",
        mode="before",
    )
    @classmethod
    def normalize_blankable_strings(cls, value: str | None) -> str:
        return _blankable_string(value)


class ProjectUpdateDTO(EnterpriseBaseDTO):
    """Data contract for partial or full updates of a project."""
    title: str | None = Field(None, min_length=1, max_length=200)
    date_time: datetime | None = None
    timezone: str | None = None
    call_time: datetime | None = None
    conductor: UUID | None = None
    location_id: UUID | None = None
    description: str | None = None
    dress_code_male: str | None = Field(None, max_length=100)
    dress_code_female: str | None = Field(None, max_length=100)
    status: str | None = Field(None, max_length=10)
    spotify_playlist_url: str | None = None
    run_sheet: list[dict[str, Any]] | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        return _validate_timezone(value) if value is not None else value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        return _require_choice(value, PROJECT_STATUS_VALUES, "status") if value is not None else value

    @field_validator(
        "description",
        "dress_code_male",
        "dress_code_female",
        "spotify_playlist_url",
        mode="before",
    )
    @classmethod
    def normalize_nullable_blankable_strings(cls, value: str | None) -> str:
        return _blankable_string(value)

    @field_validator("run_sheet", mode="before")
    @classmethod
    def normalize_nullable_run_sheet(cls, value: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
        return [] if value is None else value

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        for field_name in ("title", "date_time", "timezone", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self


class RehearsalCreateDTO(EnterpriseBaseDTO):
    """Data contract for scheduling a new rehearsal."""
    project_id: UUID
    date_time: datetime
    timezone: str = 'Europe/Warsaw'
    location_id: UUID | None = None
    focus: str = Field(default='', max_length=255)
    is_mandatory: bool = True

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        return _validate_timezone(value)

    @field_validator("focus", mode="before")
    @classmethod
    def normalize_focus(cls, value: str | None) -> str:
        return _blankable_string(value)


class RehearsalUpdateDTO(EnterpriseBaseDTO):
    """Data contract for updating an existing rehearsal."""
    date_time: datetime | None = None
    timezone: str | None = None
    location_id: UUID | None = None
    focus: str | None = Field(None, max_length=255)
    is_mandatory: bool | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        return _validate_timezone(value) if value is not None else value

    @field_validator("focus", mode="before")
    @classmethod
    def normalize_focus(cls, value: str | None) -> str:
        return _blankable_string(value)

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        for field_name in ("date_time", "timezone", "is_mandatory"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self
