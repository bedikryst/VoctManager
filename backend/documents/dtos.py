# documents/dtos.py
# ==========================================
# Chorister Hub Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.constants import AppRole, VoiceLine

from .models import DocumentIconKey

APP_ROLE_VALUES = frozenset(AppRole.values)
DOCUMENT_ICON_VALUES = frozenset(DocumentIconKey.values)
VOICE_LINE_VALUES = frozenset(VoiceLine.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value


def _validate_roles(values: tuple[str, ...]) -> tuple[str, ...]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        _require_choice(value, APP_ROLE_VALUES, "allowed_roles")
        if value in seen:
            duplicates.add(value)
        seen.add(value)

    if duplicates:
        duplicate_list = ", ".join(sorted(duplicates))
        raise ValueError(f"allowed_roles contains duplicates: {duplicate_list}.")
    return values


class DocumentsBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)


class DocumentCategoryCreateDTO(DocumentsBaseDTO):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120, pattern=r'^[-a-zA-Z0-9_]+$')
    description: str = Field(default='', max_length=2000)
    icon_key: str = Field(..., max_length=20)
    order: int = Field(default=0, ge=0)
    allowed_roles: tuple[str, ...] = Field(..., min_length=1)

    @field_validator("icon_key")
    @classmethod
    def validate_icon_key(cls, value: str) -> str:
        return _require_choice(value, DOCUMENT_ICON_VALUES, "icon_key")

    @field_validator("allowed_roles")
    @classmethod
    def validate_allowed_roles(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _validate_roles(value)


class DocumentCategoryUpdateDTO(DocumentsBaseDTO):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=2000)
    icon_key: str | None = Field(None, max_length=20)
    order: int | None = Field(None, ge=0)
    allowed_roles: tuple[str, ...] | None = Field(None, min_length=1)

    @field_validator("icon_key")
    @classmethod
    def validate_icon_key(cls, value: str | None) -> str | None:
        return _require_choice(value, DOCUMENT_ICON_VALUES, "icon_key") if value is not None else value

    @field_validator("allowed_roles")
    @classmethod
    def validate_allowed_roles(cls, value: tuple[str, ...] | None) -> tuple[str, ...] | None:
        return _validate_roles(value) if value is not None else value


class DocumentCreateDTO(DocumentsBaseDTO):
    category_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default='', max_length=2000)
    allowed_roles: tuple[str, ...] = Field(default_factory=tuple)
    order: int = Field(default=0, ge=0)
    uploaded_by_id: int | None = None

    @field_validator("allowed_roles")
    @classmethod
    def validate_allowed_roles(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _validate_roles(value)


class ArtistMetricsQueryDTO(DocumentsBaseDTO):
    artist_id: UUID
    user_id: int


class VocalLineEntryDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    voice_line: str
    voice_line_display: str
    count: int = Field(..., ge=0)

    @field_validator("voice_line")
    @classmethod
    def validate_voice_line(cls, value: str) -> str:
        return _require_choice(value, VOICE_LINE_VALUES, "voice_line")


class ArtistIdentityMetricsDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    total_concerts: int = Field(..., ge=0)
    active_seasons: int = Field(..., ge=0)
    season_years: tuple[int, ...]
    vocal_line_distribution: tuple[VocalLineEntryDTO, ...]
    first_project_year: int | None
