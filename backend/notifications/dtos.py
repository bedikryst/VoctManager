# notifications/dtos.py
# ==========================================
# Notifications Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import DeviceType, NotificationLevel, NotificationType

DEVICE_TYPE_VALUES = frozenset(DeviceType.values)
NOTIFICATION_LEVEL_VALUES = frozenset(NotificationLevel.values)
NOTIFICATION_TYPE_VALUES = frozenset(NotificationType.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value

class EnterpriseBaseDTO(BaseModel):
    """Base payload model ensuring immutability for Celery serialization."""
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)

# ==========================================
# METADATA SCHEMAS (STRICT TYPING)
# ==========================================

# --- Project Management ---
class ProjectInvitationMetadata(EnterpriseBaseDTO):
    project_id: UUID
    project_name: str
    participation_id: UUID
    inviter_name: str
    date_range: str
    location: str
    description: str
    message: str | None = None

class ProjectUpdatedMetadata(EnterpriseBaseDTO):
    project_id: UUID | None = None 
    project_name: str
    message: str | None = None
    changes: tuple[str, ...] | None = None

# --- Rehearsals ---
class RehearsalScheduledMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID
    project_id: UUID
    project_name: str
    message: str | None = None

class RehearsalUpdatedMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID
    project_name: str
    changes: tuple[str, ...]
    message: str | None = None

class RehearsalCancelledMetadata(EnterpriseBaseDTO):
    project_name: str
    message: str

# --- Casting & Repertoire ---
class PieceCastingMetadata(EnterpriseBaseDTO):
    piece_id: UUID | None = None
    piece_title: str
    voice_line: str | None = None
    message: str | None = None
    changes: tuple[str, ...] | None = None

# --- HR & Logistics ---
class CrewAssignedMetadata(EnterpriseBaseDTO):
    project_id: UUID
    project_name: str
    role: str
    message: str | None = None

class AbsenceStatusMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID
    project_name: str
    rehearsal_date: str
    message: str | None = None


class ManagerActionMetadata(EnterpriseBaseDTO):
    project_name: str
    artist_name: str
    action_details: str  # e.g. "Accepted", "Declined", "Updated excuse note"
    rehearsal_date: str | None = None
    message: str | None = None


class CustomAdminMessageMetadata(EnterpriseBaseDTO):
    """Payload for direct manager-to-artist messages. Carries sender context for read receipts."""
    title: str = Field(..., max_length=120)
    message: str = Field(..., max_length=2000)
    sender_id: str | UUID
    sender_name: str
    level: str = Field(default="INFO")
    cta_url: str | None = Field(None, max_length=500)
    cta_label: str | None = Field(None, max_length=80)

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_LEVEL_VALUES, "level")


class NotificationReadReceiptMetadata(EnterpriseBaseDTO):
    """Payload sent back to the manager when the artist reads a CUSTOM_ADMIN_MESSAGE."""
    artist_name: str
    artist_id: str | UUID
    original_title: str
    read_at: str


class ProjectReminderMetadata(EnterpriseBaseDTO):
    project_id: UUID | None = None
    project_name: str
    date_range: str | None = None
    starts_at: str | None = None
    message: str | None = None


class RehearsalReminderMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID | None = None
    project_name: str
    starts_at: str | None = None
    rehearsal_date: str | None = None
    message: str | None = None


class MaterialUploadedMetadata(EnterpriseBaseDTO):
    piece_id: UUID | None = None
    material_id: UUID | None = None
    piece_title: str | None = None
    project_name: str | None = None
    message: str | None = None


class ContractIssuedMetadata(EnterpriseBaseDTO):
    contract_id: UUID | None = None
    project_id: UUID | None = None
    project_name: str
    message: str | None = None


class SystemAlertMetadata(EnterpriseBaseDTO):
    title: str | None = Field(None, max_length=120)
    message: str | None = Field(None, max_length=2000)
    cta_url: str | None = Field(None, max_length=500)


# Polymorphic Payload Definition
NotificationMetadataPayload = (
    ProjectInvitationMetadata
    | ProjectUpdatedMetadata
    | ProjectReminderMetadata
    | RehearsalScheduledMetadata
    | RehearsalUpdatedMetadata
    | RehearsalCancelledMetadata
    | RehearsalReminderMetadata
    | PieceCastingMetadata
    | CrewAssignedMetadata
    | AbsenceStatusMetadata
    | ManagerActionMetadata
    | CustomAdminMessageMetadata
    | NotificationReadReceiptMetadata
    | MaterialUploadedMetadata
    | ContractIssuedMetadata
    | SystemAlertMetadata
)

# ==========================================
# CORE DATA TRANSFER OBJECT
# ==========================================

class NotificationCreateDTO(EnterpriseBaseDTO):
    """
    Data Transfer Object strictly typing the payload for notification creation.
    Guarantees structural integrity before passing to Celery and Service layers.
    """
    recipient_id: int | str
    notification_type: str = Field(..., max_length=50)
    level: str = Field(..., max_length=20)
    # A structured metadata model when provided, or a plain dict (the empty default, or
    # the already-serialized payload re-hydrated from Celery). Both are accepted by design.
    metadata: NotificationMetadataPayload | dict[str, Any] = Field(default_factory=dict)

    @field_validator("notification_type")
    @classmethod
    def validate_notification_type(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_TYPE_VALUES, "notification_type")

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_LEVEL_VALUES, "level")

class PushDeviceRegisterDTO(BaseModel):
    """DTO for FCM token registration (iOS / Android)."""
    model_config = ConfigDict(extra="forbid", frozen=True, validate_by_name=True, validate_by_alias=True)

    user_id: int | str
    registration_token: str = Field(..., min_length=10, description="The client-provided FCM token.")
    device_type: str = Field(default="WEB", description="Platform identifier.")

    @field_validator("device_type")
    @classmethod
    def validate_device_type(cls, value: str) -> str:
        return _require_choice(value, DEVICE_TYPE_VALUES, "device_type")


class WebPushSubscribeDTO(BaseModel):
    """DTO for Web Push (VAPID) subscription registration from browser clients."""
    model_config = ConfigDict(extra="forbid", frozen=True, validate_by_name=True, validate_by_alias=True)

    user_id: int | str
    endpoint: str = Field(..., min_length=1, description="Browser-assigned push endpoint URL.")
    p256dh_key: str = Field(..., min_length=10, description="ECDH public key for payload encryption.")
    auth_key: str = Field(..., min_length=10, description="Auth secret for payload encryption.")


class NotificationPreferenceUpdateDTO(BaseModel):
    """DTO for granular mutation of user notification preferences."""
    model_config = ConfigDict(extra="forbid", frozen=True, validate_by_name=True, validate_by_alias=True)

    user_id: int | str
    notification_type: str = Field(..., description="Target business event category.")
    email_enabled: bool | None = Field(None, description="Toggle Email delivery.")
    push_enabled: bool | None = Field(None, description="Toggle Push delivery.")

    @field_validator("notification_type")
    @classmethod
    def validate_notification_type(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_TYPE_VALUES, "notification_type")

    @model_validator(mode="after")
    def require_at_least_one_channel(self):
        if self.email_enabled is None and self.push_enabled is None:
            raise ValueError("At least one notification channel toggle must be provided.")
        return self

