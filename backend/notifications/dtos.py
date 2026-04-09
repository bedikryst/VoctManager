# notifications/dtos.py
from typing import Any, Union, List
from typing_extensions import TypedDict, NotRequired 
from dataclasses import dataclass, field

# ==========================================
# METADATA SCHEMAS (STRICT TYPING)
# ==========================================

# --- Project Management ---
class ProjectInvitationMetadata(TypedDict):
    project_id: str
    project_name: str
    message: NotRequired[str]

class ProjectUpdatedMetadata(TypedDict):
    project_id: NotRequired[str] 
    project_name: str
    message: NotRequired[str]
    changes: NotRequired[List[str]]

# --- Rehearsals ---
class RehearsalScheduledMetadata(TypedDict):
    rehearsal_id: str
    project_id: str
    project_name: str

class RehearsalUpdatedMetadata(TypedDict):
    rehearsal_id: str
    project_name: str
    changes: List[str]

class RehearsalCancelledMetadata(TypedDict):
    project_name: str
    message: str

# --- Casting & Repertoire ---
class PieceCastingMetadata(TypedDict):
    piece_id: NotRequired[str]
    piece_title: str
    voice_line: NotRequired[str]
    message: NotRequired[str]

# --- HR & Logistics ---
class CrewAssignedMetadata(TypedDict):
    project_id: str
    project_name: str
    role: str

class AbsenceStatusMetadata(TypedDict):
    rehearsal_id: str

NotificationMetadataPayload = Union[
    ProjectInvitationMetadata,
    ProjectUpdatedMetadata,
    RehearsalScheduledMetadata,
    RehearsalUpdatedMetadata,
    RehearsalCancelledMetadata,
    PieceCastingMetadata,
    CrewAssignedMetadata,
    AbsenceStatusMetadata,
    dict #Fallback
]

# ==========================================
# DATA TRANSFER OBJECTS
# ==========================================

@dataclass(frozen=True)
class NotificationCreateDTO:
    """
    Data Transfer Object strictly typing the payload for notification creation.
    Guarantees structural integrity before passing to Celery and Service layers.
    """
    recipient_id: str
    notification_type: str
    level: str
    metadata: NotificationMetadataPayload = field(default_factory=dict)