# archive/dtos.py
# ==========================================
# Archive Data Transfer Objects (DTOs)
# ==========================================
from dataclasses import dataclass
from typing import Optional, List

@dataclass(frozen=True)
class VoiceRequirementDTO:
    voice_line: str
    quantity: int

@dataclass(frozen=True)
class PieceWriteDTO:
    """Immutable data transfer object for creating or updating a musical piece."""
    title: str
    composer_id: Optional[str] = None
    arranger: Optional[str] = None
    language: Optional[str] = None
    estimated_duration: Optional[int] = None
    voicing: str = ""
    description: str = ""
    lyrics_original: Optional[str] = None
    lyrics_translation: Optional[str] = None
    reference_recording_youtube: Optional[str] = None
    reference_recording_spotify: Optional[str] = None
    composition_year: Optional[int] = None
    epoch: Optional[str] = None
    voice_requirements: Optional[List[VoiceRequirementDTO]] = None