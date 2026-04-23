# notifications/dtos.py
# ==========================================
# Notifications Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Union, List, Dict, Any
from uuid import UUID

class EnterpriseBaseDTO(BaseModel):
    """Base payload model ensuring immutability for Celery serialization."""
    model_config = ConfigDict(frozen=True, extra='forbid')

# ==========================================
# METADATA SCHEMAS (STRICT TYPING)
# ==========================================

# --- Project Management ---
class ProjectInvitationMetadata(EnterpriseBaseDTO):
    project_id: UUID
    project_name: str
    message: Optional[str] = None

class ProjectUpdatedMetadata(EnterpriseBaseDTO):
    project_id: Optional[UUID] = None 
    project_name: str
    message: Optional[str] = None
    changes: Optional[List[str]] = None

# --- Rehearsals ---
class RehearsalScheduledMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID
    project_id: UUID
    project_name: str

class RehearsalUpdatedMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID
    project_name: str
    changes: List[str]

class RehearsalCancelledMetadata(EnterpriseBaseDTO):
    project_name: str
    message: str

# --- Casting & Repertoire ---
class PieceCastingMetadata(EnterpriseBaseDTO):
    piece_id: Optional[UUID] = None
    piece_title: str
    voice_line: Optional[str] = None
    message: Optional[str] = None

# --- HR & Logistics ---
class CrewAssignedMetadata(EnterpriseBaseDTO):
    project_id: UUID
    project_name: str
    role: str

class AbsenceStatusMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID

# Polymorphic Payload Definition
NotificationMetadataPayload = Union[
    ProjectInvitationMetadata,
    ProjectUpdatedMetadata,
    RehearsalScheduledMetadata,
    RehearsalUpdatedMetadata,
    RehearsalCancelledMetadata,
    PieceCastingMetadata,
    CrewAssignedMetadata,
    AbsenceStatusMetadata,
    Dict[str, Any] # Enterprise fallback for manual custom alerts
]

# ==========================================
# CORE DATA TRANSFER OBJECT
# ==========================================

class NotificationCreateDTO(EnterpriseBaseDTO):
    """
    Data Transfer Object strictly typing the payload for notification creation.
    Guarantees structural integrity before passing to Celery and Service layers.
    """
    recipient_id: Union[int, str, UUID]
    notification_type: str = Field(..., max_length=50)
    level: str = Field(..., max_length=20)
    metadata: NotificationMetadataPayload = Field(default_factory=dict)

class PushDeviceRegisterDTO(BaseModel):
    """DTO for incoming device token registration requests."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    user_id: UUID
    registration_token: str = Field(..., min_length=10, description="The client-provided push token.")
    device_type: str = Field(default="WEB", description="Platform identifier.")


class NotificationPreferenceUpdateDTO(BaseModel):
    """DTO for granular mutation of user notification preferences."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    user_id: UUID
    notification_type: str = Field(..., description="Target business event category.")
    email_enabled: Optional[bool] = Field(None, description="Toggle Email delivery.")
    push_enabled: Optional[bool] = Field(None, description="Toggle Push delivery.")
    sms_enabled: Optional[bool] = Field(None, description="Toggle SMS delivery.")