# documents/dtos.py
# ==========================================
# Chorister Hub Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID


class DocumentsBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')


class DocumentCategoryCreateDTO(DocumentsBaseDTO):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120, pattern=r'^[-a-zA-Z0-9_]+$')
    description: str = Field(default='', max_length=2000)
    icon_key: str = Field(..., max_length=20)
    order: int = Field(default=0, ge=0)
    allowed_roles: list[str] = Field(..., min_length=1)


class DocumentCategoryUpdateDTO(DocumentsBaseDTO):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    icon_key: Optional[str] = Field(None, max_length=20)
    order: Optional[int] = Field(None, ge=0)
    allowed_roles: Optional[list[str]] = None


class DocumentCreateDTO(DocumentsBaseDTO):
    category_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default='', max_length=2000)
    allowed_roles: list[str] = Field(default_factory=list)
    order: int = Field(default=0, ge=0)
    uploaded_by_id: Optional[int] = None


class ArtistMetricsQueryDTO(DocumentsBaseDTO):
    artist_id: UUID
    user_id: int


class VocalLineEntryDTO(BaseModel):
    model_config = ConfigDict(frozen=True)

    voice_line: str
    voice_line_display: str
    count: int


class ArtistIdentityMetricsDTO(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_concerts: int
    active_seasons: int
    season_years: list[int]
    vocal_line_distribution: list[VocalLineEntryDTO]
    first_project_year: Optional[int]
