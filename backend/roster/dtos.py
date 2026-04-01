# roster/dtos.py
# ==========================================
# Roster Data Transfer Objects (DTOs)
# ==========================================
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class ArtistCreateDTO:
    first_name: str
    last_name: str
    email: str
    voice_type: str
    phone_number: Optional[str] = None
    sight_reading_skill: Optional[int] = None
    vocal_range_bottom: Optional[str] = None
    vocal_range_top: Optional[str] = None

@dataclass(frozen=True)
class AttendanceRecordDTO:
    requesting_user_id: int
    is_superuser: bool
    participation_id: str
    rehearsal_id: str

@dataclass(frozen=True)
class ProjectBulkFeeDTO:
    project_id: str
    new_fee: int

@dataclass(frozen=True)
class ParticipationRestoreDTO:
    artist_id: str
    project_id: str