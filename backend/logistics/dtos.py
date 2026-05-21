from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import LocationCategory

LOCATION_CATEGORY_VALUES = frozenset(LocationCategory.values)


def _strip_required(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Value cannot be blank.")
    return stripped


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _blank_to_empty(value: str | None) -> str:
    return "" if value is None else value


class LogisticsBaseDTO(BaseModel):
    """Base DTO for validated logistics service payloads."""

    model_config = ConfigDict(frozen=True, extra="forbid")


class LocationCreateDTO(LogisticsBaseDTO):
    """Immutable DTO for creating a location."""

    name: str = Field(..., min_length=1, max_length=255)
    category: str
    formatted_address: str = Field(..., min_length=1)
    google_place_id: str | None = Field(None, max_length=512)
    latitude: Decimal | None = Field(None, ge=Decimal("-90"), le=Decimal("90"), decimal_places=6)
    longitude: Decimal | None = Field(None, ge=Decimal("-180"), le=Decimal("180"), decimal_places=6)
    internal_notes: str = ""

    @field_validator("name", "formatted_address", mode="before")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return _strip_required(value)

    @field_validator("google_place_id", mode="before")
    @classmethod
    def normalize_google_place_id(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @field_validator("internal_notes", mode="before")
    @classmethod
    def normalize_internal_notes(cls, value: str | None) -> str:
        return _blank_to_empty(value)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in LOCATION_CATEGORY_VALUES:
            allowed = ", ".join(sorted(LOCATION_CATEGORY_VALUES))
            raise ValueError(f"category must be one of: {allowed}.")
        return value


class LocationUpdateDTO(LogisticsBaseDTO):
    """Immutable DTO for partial or full location updates."""

    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = None
    formatted_address: str | None = Field(None, min_length=1)
    google_place_id: str | None = Field(None, max_length=512)
    latitude: Decimal | None = Field(None, ge=Decimal("-90"), le=Decimal("90"), decimal_places=6)
    longitude: Decimal | None = Field(None, ge=Decimal("-180"), le=Decimal("180"), decimal_places=6)
    internal_notes: str | None = None
    is_active: bool | None = None

    @field_validator("name", "formatted_address", mode="before")
    @classmethod
    def normalize_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _strip_required(value)

    @field_validator("google_place_id", mode="before")
    @classmethod
    def normalize_google_place_id(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @field_validator("internal_notes", mode="before")
    @classmethod
    def normalize_internal_notes(cls, value: str | None) -> str:
        return _blank_to_empty(value)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if value not in LOCATION_CATEGORY_VALUES:
            allowed = ", ".join(sorted(LOCATION_CATEGORY_VALUES))
            raise ValueError(f"category must be one of: {allowed}.")
        return value

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        for field_name in ("name", "category", "formatted_address", "is_active"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self
