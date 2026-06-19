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


class RepertoireEntryDTO(BaseModel):
    """One distinct piece the artist has performed across completed projects."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    piece_id: UUID
    title: str
    composer_name: str
    epoch: str
    voice_lines: tuple[str, ...]
    performances: int = Field(..., ge=1)
    years: tuple[int, ...]


class ArtistIdentityMetricsDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    total_concerts: int = Field(..., ge=0)
    active_seasons: int = Field(..., ge=0)
    season_years: tuple[int, ...]
    vocal_line_distribution: tuple[VocalLineEntryDTO, ...]
    first_project_year: int | None
    total_pieces: int = Field(default=0, ge=0)
    total_composers: int = Field(default=0, ge=0)
    attendance_rate: float | None = Field(default=None, ge=0, le=100)
    repertoire: tuple[RepertoireEntryDTO, ...] = ()


# --- Concert roster ("Z kim śpiewam") ---
# Strictly concert-and-piece-scoped: for each of the caller's OWN confirmed, upcoming
# concerts, and within it only the pieces the caller is cast on, the co-singers grouped
# by the voice line they sing IN THAT PIECE (it may differ piece to piece). It never
# exposes the full ensemble, nor anyone's default/assigned voice type, nor the
# conductor's private capability data (sight-reading, vocal range). It exists only to
# serve the concert. `extra="forbid"` makes any accidental leak fail loudly.


class SectionMemberDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    artist_id: UUID
    first_name: str
    last_name: str
    avatar_thumb_url: str | None = None
    is_me: bool = False


class PieceVoiceSectionDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    voice_line: str
    voice_line_display: str
    # True when the caller themselves sings this voice line in this piece.
    is_mine: bool = False
    members: tuple[SectionMemberDTO, ...] = ()


class ConcertPieceDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    piece_id: UUID
    title: str
    sections: tuple[PieceVoiceSectionDTO, ...] = ()


class ConcertRosterDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    project_id: UUID
    title: str
    date: str | None = None
    pieces: tuple[ConcertPieceDTO, ...] = ()


class EnsembleMeDTO(BaseModel):
    """The caller's own standing — self-knowledge only (shown only to themselves)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    voice_type_display: str | None
    is_active: bool = False
    is_linked: bool = False


class MyEnsembleDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    me: EnsembleMeDTO
    concerts: tuple[ConcertRosterDTO, ...] = ()
