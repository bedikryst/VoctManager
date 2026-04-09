# archive/dtos.py
# ==========================================
# Archive Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from typing import Optional, List
from uuid import UUID

class EnterpriseBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

class VoiceRequirementDTO(EnterpriseBaseDTO):
    voice_line: str = Field(..., min_length=1, max_length=12)
    # Enterprise constraint: you cannot require 0 or negative singers
    quantity: int = Field(..., ge=1)

class PieceWriteDTO(EnterpriseBaseDTO):
    """Immutable data transfer object for creating or updating a musical piece."""
    title: str = Field(..., min_length=1, max_length=200)
    
    # UUID typing ensures valid identifiers before database hits
    composer_id: Optional[UUID] = None
    
    arranger: Optional[str] = Field(None, max_length=150)
    language: Optional[str] = Field(None, max_length=50)
    
    # Duration cannot be negative
    estimated_duration: Optional[int] = Field(None, ge=0, description="Duration in seconds")
    voicing: str = Field(default="", max_length=50)
    description: str = Field(default="")
    
    lyrics_original: Optional[str] = None
    lyrics_translation: Optional[str] = None
    
    # HttpUrl automatically validates standard URL schemas!
    reference_recording_youtube: Optional[HttpUrl] = None
    reference_recording_spotify: Optional[HttpUrl] = None
    
    # Basic sanity check for composition years
    composition_year: Optional[int] = Field(None, ge=500, le=2100)
    epoch: Optional[str] = Field(None, max_length=4)
    
    voice_requirements: Optional[List[VoiceRequirementDTO]] = None