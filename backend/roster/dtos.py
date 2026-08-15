# roster/dtos.py
# ==========================================
# Roster Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from datetime import datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from core.constants import VoiceLine

from .models import Attendance, Participation, PieceReadiness, Project, VoiceType

SUPPORTED_LANGUAGE_CODES = frozenset({"en", "pl", "fr"})
SALUTATION_VALUES = frozenset({"F", "M", "N"})
ATTENDANCE_STATUS_VALUES = frozenset(Attendance.Status.values)
PROJECT_STATUS_VALUES = frozenset(Project.Status.values)
PARTICIPATION_STATUS_VALUES = frozenset(Participation.Status.values)
VOICE_TYPE_VALUES = frozenset(VoiceType.values)
VOICE_LINE_VALUES = frozenset(VoiceLine.values)
PIECE_READINESS_STATUS_VALUES = frozenset(PieceReadiness.Status.values)


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


def _strip_required_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if not stripped:
        raise ValueError("Value cannot be blank.")
    return stripped


def _blankable_string(value: object) -> object:
    if value is None:
        return ""
    if not isinstance(value, str):
        return value
    return value.strip()


def _blankable_optional_string(value: object) -> object:
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    return stripped or None


def _validate_day_window(
    start: time | None, end: time | None, field_prefix: str
) -> None:
    """A window of the concert day is start-then-end, on that day.

    An end with no start is not a window, it is a stray hour with nothing to
    attach to; an end at or before its start is a typo the printed timeline
    would state as a fact. Both are rejected at the boundary rather than
    normalized away, because silently dropping a time the producer typed is how
    a sheet ends up missing the very moment they meant to publish.
    """
    if end is None:
        return
    if start is None:
        raise ValueError(f"{field_prefix}_end requires {field_prefix}_start.")
    if end <= start:
        raise ValueError(f"{field_prefix}_end must be later than {field_prefix}_start.")


def _freeze_sequence(value: object) -> object:
    """Container coercion only — a DTO field must not be a mutable list shared
    with the caller. The *contents* of ``run_sheet`` are deliberately not read
    here: the rows are unvalidated free JSON, and the one place that interprets
    them is ``roster.domain.day_timeline.normalize_run_sheet``, which the
    documents and the panel both read. Two normalizers over one field would be
    two answers to "what is the day"."""
    if value is None:
        return ()
    if isinstance(value, list | tuple):
        return tuple(value)
    return value


class EnterpriseBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)


class ArtistCreateDTO(EnterpriseBaseDTO):
    # Widths track `AbstractUser` (150), which is where these values are actually
    # persisted — a narrower limit here would reject a name the account accepts.
    first_name: str = Field(..., min_length=1, max_length=150)
    last_name: str = Field(..., min_length=1, max_length=150)
    first_name_vocative: str | None = Field(None, max_length=150)
    email: EmailStr
    voice_type: str = Field(..., min_length=2, max_length=5)
    phone_number: str | None = Field(None, max_length=32)
    sight_reading_skill: int | None = Field(None, ge=1, le=5)
    vocal_range_bottom: str | None = Field(None, max_length=5)
    vocal_range_top: str | None = Field(None, max_length=5)
    language: str = Field(default='pl', max_length=10)
    salutation: str = Field(default='N', max_length=1)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> object:
        return _strip_required_text(value)

    @field_validator("first_name_vocative", "phone_number", "vocal_range_bottom", "vocal_range_top", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        return _blankable_optional_string(value)

    @field_validator("voice_type")
    @classmethod
    def validate_voice_type(cls, value: str) -> str:
        return _require_choice(value, VOICE_TYPE_VALUES, "voice_type")

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _require_choice(value, SUPPORTED_LANGUAGE_CODES, "language")

    @field_validator("salutation")
    @classmethod
    def validate_salutation(cls, value: str) -> str:
        return _require_choice((value or "N").upper(), SALUTATION_VALUES, "salutation")


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

    @field_validator("excuse_note", mode="before")
    @classmethod
    def normalize_excuse_note(cls, value: object) -> object:
        return _blankable_string(value)


class ParticipationStatusUpdateDTO(EnterpriseBaseDTO):
    """Data contract for artist or manager participation status changes."""

    status: str = Field(..., max_length=3)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _require_choice(value, PARTICIPATION_STATUS_VALUES, "status")


class PieceReadinessUpdateDTO(EnterpriseBaseDTO):
    """Data contract for an artist's practice-readiness self report on one piece."""

    piece: UUID
    status: str = Field(..., max_length=12)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _require_choice(value, PIECE_READINESS_STATUS_VALUES, "status")


class PieceCastingRowDTO(EnterpriseBaseDTO):
    """One seat on the divisi board: this participant, on this voice line."""

    participation: UUID
    voice_line: str = Field(..., max_length=5)
    gives_pitch: bool = False
    notes: str = Field(default='', max_length=200)

    @field_validator("voice_line")
    @classmethod
    def validate_voice_line(cls, value: str) -> str:
        return _require_choice(value, VOICE_LINE_VALUES, "voice_line")

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> object:
        return _blankable_string(value)


class PieceCastingBoardDTO(EnterpriseBaseDTO):
    """The complete divisi board for one piece of one project.

    Declarative rather than incremental: whatever the conductor sees on screen is
    what gets sent, and the server reconciles. One save is one request and at most
    one announcement per affected singer — where the per-casting endpoints issued
    one of each per drag, and could leave the board half-written when a later call
    failed.

    An empty `castings` list is legitimate — it clears the piece.
    """

    project: UUID
    piece: UUID
    castings: tuple[PieceCastingRowDTO, ...] = Field(default_factory=tuple)

    @field_validator("castings", mode="before")
    @classmethod
    def normalize_castings(cls, value: object) -> object:
        if value is None:
            return ()
        if isinstance(value, list | tuple):
            return tuple(value)
        return value

    @model_validator(mode="after")
    def reject_repeated_participants(self):
        seen: set[UUID] = set()
        for row in self.castings:
            if row.participation in seen:
                raise ValueError("castings must hold at most one voice line per participant.")
            seen.add(row.participation)
        return self


class ProjectBulkFeeDTO(EnterpriseBaseDTO):
    project_id: UUID
    # The API/frontend speaks `fee`; `new_fee` stays the internal name. Without the
    # alias the bulk endpoint 400'd on every call (extra="forbid" rejected `fee`).
    new_fee: Decimal = Field(..., ge=0, max_digits=8, decimal_places=2, alias="fee")


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
    run_sheet: tuple[dict[str, Any], ...] = Field(default_factory=tuple)
    entrance_note: str = Field(default='', max_length=200)
    parking_note: str = Field(default='', max_length=200)
    dressing_room_note: str = Field(default='', max_length=200)
    warmup_start: time | None = None
    warmup_end: time | None = None
    soundcheck_start: time | None = None
    soundcheck_end: time | None = None
    onsite_contact_name: str = Field(default='', max_length=120)
    onsite_contact_phone: str = Field(default='', max_length=32)

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return _strip_required_text(value)

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
        "entrance_note",
        "parking_note",
        "dressing_room_note",
        "onsite_contact_name",
        "onsite_contact_phone",
        mode="before",
    )
    @classmethod
    def normalize_blankable_strings(cls, value: object) -> object:
        return _blankable_string(value)

    @field_validator("run_sheet", mode="before")
    @classmethod
    def normalize_run_sheet(cls, value: object) -> object:
        return _freeze_sequence(value)

    @model_validator(mode="after")
    def validate_day_windows(self):
        _validate_day_window(self.warmup_start, self.warmup_end, "warmup")
        _validate_day_window(self.soundcheck_start, self.soundcheck_end, "soundcheck")
        return self


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
    run_sheet: tuple[dict[str, Any], ...] | None = None
    entrance_note: str | None = Field(None, max_length=200)
    parking_note: str | None = Field(None, max_length=200)
    dressing_room_note: str | None = Field(None, max_length=200)
    warmup_start: time | None = None
    warmup_end: time | None = None
    soundcheck_start: time | None = None
    soundcheck_end: time | None = None
    onsite_contact_name: str | None = Field(None, max_length=120)
    onsite_contact_phone: str | None = Field(None, max_length=32)

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        if value is None:
            return value
        return _strip_required_text(value)

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
        "entrance_note",
        "parking_note",
        "dressing_room_note",
        "onsite_contact_name",
        "onsite_contact_phone",
        mode="before",
    )
    @classmethod
    def normalize_nullable_blankable_strings(cls, value: object) -> object:
        return _blankable_string(value)

    @field_validator("run_sheet", mode="before")
    @classmethod
    def normalize_nullable_run_sheet(cls, value: object) -> object:
        return _freeze_sequence(value)

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        for field_name in ("title", "date_time", "timezone", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self

    @model_validator(mode="after")
    def validate_day_windows(self):
        """A window is validated as a pair, so both ends must travel together.

        A patch carrying only the closing hour cannot be checked against a start
        this DTO never sees, and a window whose end precedes its start prints as
        a fact on the day card. Sending both is what the editor does anyway.
        """
        for prefix in ("warmup", "soundcheck"):
            end_field, start_field = f"{prefix}_end", f"{prefix}_start"
            if end_field not in self.model_fields_set:
                continue
            if getattr(self, end_field) is not None and start_field not in self.model_fields_set:
                raise ValueError(f"{end_field} must be sent together with {start_field}.")
            _validate_day_window(
                getattr(self, start_field), getattr(self, end_field), prefix
            )
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
    def normalize_focus(cls, value: object) -> object:
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
    def normalize_focus(cls, value: object) -> object:
        return _blankable_string(value)

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        for field_name in ("date_time", "timezone", "is_mandatory"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self
