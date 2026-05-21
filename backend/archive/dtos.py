# archive/dtos.py
# ==========================================
# Archive Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from core.constants import VoiceLine

from .models import EpochChoices

EPOCH_VALUES = frozenset(EpochChoices.values)
VOICE_LINE_VALUES = frozenset(VoiceLine.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value

class EnterpriseBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

class VoiceRequirementDTO(EnterpriseBaseDTO):
    voice_line: str = Field(..., min_length=1, max_length=12)
    # Enterprise constraint: you cannot require 0 or negative singers
    quantity: int = Field(..., ge=1)

    @field_validator("voice_line")
    @classmethod
    def validate_voice_line(cls, value: str) -> str:
        return _require_choice(value, VOICE_LINE_VALUES, "voice_line")

class PieceWriteDTO(EnterpriseBaseDTO):
    """Immutable data transfer object for creating or updating a musical piece."""
    title: str = Field(..., min_length=1, max_length=200)
    
    # UUID typing ensures valid identifiers before database hits
    composer_id: UUID | None = None
    
    arranger: str | None = Field(None, max_length=150)
    language: str | None = Field(None, max_length=50)
    
    # Duration cannot be negative
    estimated_duration: int | None = Field(None, ge=0, description="Duration in seconds")
    voicing: str = Field(default="", max_length=50)
    description: str = Field(default="")
    
    lyrics_original: str | None = None
    lyrics_translation: str | None = None
    
    # HttpUrl automatically validates standard URL schemas!
    reference_recording_youtube: HttpUrl | None = None
    reference_recording_spotify: HttpUrl | None = None
    
    # Basic sanity check for composition years
    composition_year: int | None = Field(None, ge=500, le=2100)
    epoch: str | None = Field(None, max_length=4)

    opus_catalog: str = Field(default="", max_length=40)
    musical_key: str = Field(default="", max_length=20)
    text_source: str = Field(default="", max_length=200)
    lyrics_ipa: str | None = None
    
    voice_requirements: list[VoiceRequirementDTO] | None = None

    @field_validator("epoch")
    @classmethod
    def validate_epoch(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return value
        return _require_choice(value, EPOCH_VALUES, "epoch")

    @model_validator(mode="after")
    def validate_unique_voice_requirements(self):
        if not self.voice_requirements:
            return self

        seen: set[str] = set()
        duplicates: set[str] = set()
        for requirement in self.voice_requirements:
            if requirement.voice_line in seen:
                duplicates.add(requirement.voice_line)
            seen.add(requirement.voice_line)

        if duplicates:
            duplicate_list = ", ".join(sorted(duplicates))
            raise ValueError(f"voice_requirements contains duplicate voice lines: {duplicate_list}.")
        return self


# ===========================================================================
# Score Package Compiler — ingestion pipeline DTOs (added 2026-05)
# ===========================================================================
# Two categories below:
#   1. AI structured-output schemas — sent to Claude via `output_config.format`.
#      Claude is forced to satisfy them; the SDK validates before returning.
#   2. Internal value objects — frozen DTOs passed between Celery tasks.
# ===========================================================================


# --- Internal value objects (Celery payloads) -------------------------------

class CallCost(EnterpriseBaseDTO):
    """Cost of a single Claude API call, including cache attribution."""
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    total_usd: Decimal
    total_cents: int


class ProvenanceClaim(EnterpriseBaseDTO):
    """
    Describes where a single field's value came from. Persisted as a
    ProvenanceRecord row downstream — kept as a DTO until the Celery task
    that owns the database write is ready to commit.
    """
    field_name: str
    source: str           # ProvenanceSource enum value
    source_reference: str = ""
    confidence: float = 1.0
    prompt_version: str = ""
    model_version: str = ""


# --- AI structured-output schemas (NOT frozen — SDK populates them) ---------

class ExtractedWorkIdentity(BaseModel):
    """
    First-pass extraction from the front matter of a score PDF.
    The AI returns its best guess plus a confidence; the resolver step then
    cross-references MusicBrainz to canonicalize.
    """
    model_config = ConfigDict(extra='forbid')

    title: str = Field(description="Title of the work as printed on the score.")
    composer_full_name: str = Field(
        description="Composer's full name as printed (e.g. 'Johann Sebastian Bach'). "
                    "If only initials are printed, return them verbatim."
    )
    composer_birth_year: int | None = Field(
        default=None,
        description="Composer's birth year if printed on the score, else null."
    )
    opus_catalog: str | None = Field(
        default=None,
        description="Opus or catalog identifier (e.g. 'BWV 243', 'Op. 110 No. 2', 'K. 626')."
    )
    musical_key: str | None = Field(
        default=None,
        description="Musical key (e.g. 'D major', 'F# minor'). Null if not stated."
    )
    voicing: str | None = Field(
        default=None,
        description="Voicing notation (e.g. 'SATB', 'SSAATTBB', 'SATB + orch'). Null if not stated."
    )
    language: str | None = Field(
        default=None,
        description="Primary sung language of the text (e.g. 'Latin', 'German', 'English')."
    )
    text_source: str | None = Field(
        default=None,
        description="Source of the text being set (e.g. 'Luke 1:46-55', 'Psalm 23', 'liturgical Latin')."
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Self-rated confidence in this extraction, 0.0-1.0. "
                    "Use <0.5 if the PDF is illegible or appears to be the wrong type of document."
    )


class ExtractedMovement(BaseModel):
    """One movement detected inside a multi-movement work."""
    model_config = ConfigDict(extra='forbid')

    order_index: int = Field(ge=0, description="Zero-based index of this movement.")
    title: str = Field(description="Movement title, including any incipit (e.g. 'Et exsultavit spiritus meus').")
    tempo_marking: str | None = Field(
        default=None,
        description="Tempo marking if printed (e.g. 'Allegro', 'Adagio molto'). Null if absent."
    )
    starts_on_page: int | None = Field(
        default=None, ge=1,
        description="1-based page number in the source PDF where this movement begins, if determinable."
    )


class ExtractedMovementList(BaseModel):
    """Detected movements for a Piece. Single-movement works return one entry."""
    model_config = ConfigDict(extra='forbid')

    movements: list[ExtractedMovement] = Field(description="Movements in performance order.")


class GeneratedProgramNote(BaseModel):
    """Audience-facing program note generated by the AI."""
    model_config = ConfigDict(extra='forbid')

    content: str = Field(
        description="The program note text. Plain prose, no Markdown. "
                    "Target the requested word count and tone."
    )
    actual_word_count: int = Field(ge=1)


class TranslationPayload(BaseModel):
    """A single language's translation of the sung text."""
    model_config = ConfigDict(extra='forbid')

    target_language: str = Field(
        description="ISO 639-1 code of the translation language (e.g. 'en', 'pl', 'fr')."
    )
    text: str = Field(description="The translated text, preserving line breaks of the original.")
    is_singable: bool = Field(
        description="True if the translation preserves meter for singing in the original musical lines. "
                    "False if it is a literal prose translation for understanding."
    )


class LyricsExtractionResult(BaseModel):
    """Extracted sung text plus IPA pronunciation guide and zero or more translations."""
    model_config = ConfigDict(extra='forbid')

    sung_text_language: str = Field(
        description="ISO 639-1 code of the sung text language (e.g. 'la', 'de', 'en')."
    )
    sung_text: str = Field(description="The original sung text, preserving line breaks.")
    ipa_transcription: str = Field(
        description="IPA pronunciation guide for the sung text, aligned line-by-line with sung_text."
    )
    translations: list[TranslationPayload] = Field(
        default_factory=list,
        description="Zero or more translations into the requested target languages."
    )


# --- External-source lookups (consumed by Phase 1 clients) -----------------

class ComposerLookupResult(EnterpriseBaseDTO):
    """Canonical composer metadata fetched from MusicBrainz / Wikidata."""
    mbid: UUID | None = None
    wikidata_qid: str = ""
    canonical_first_name: str = ""
    canonical_last_name: str = ""
    birth_year: int | None = None
    death_year: int | None = None
    nationality: str = ""
    period: str = ""              # EpochChoices value
    bio: str = ""
    portrait_url: str = ""
    portrait_license: str = ""
    aliases: tuple[str, ...] = ()
    source: Literal['musicbrainz', 'wikidata', 'mixed', 'none'] = 'none'


class WorkLookupResult(EnterpriseBaseDTO):
    """
    Canonical work metadata from MusicBrainz. Used by the resolver to
    deduplicate Pieces and pull in composer mbid + canonical title.
    """
    mbid: UUID
    canonical_title: str
    composer_mbid: UUID | None = None
    composer_name: str = ""
    opus_catalog: str = ""
    musical_key: str = ""
    language: str = ""
    work_type: str = ""           # e.g. 'Mass', 'Motet', 'Anthem' (from MB type/attributes)
    score: int = 0                # MB's search score 0-100 (higher = better match)


class RecordingLookupResult(EnterpriseBaseDTO):
    """One Spotify track or YouTube video matched to a piece."""
    source: Literal['spotify', 'youtube']
    external_id: str              # Spotify track ID or YouTube video ID
    url: str
    title: str = ""
    performer: str = ""           # artist / channel name
    year: int | None = None
    duration_seconds: int | None = None
    relevance_rank: int = 0       # 0 = top hit, 1 = next, …


class RecordingSearchResult(EnterpriseBaseDTO):
    """A ranked list of candidate recordings for one work."""
    query: str
    results: tuple[RecordingLookupResult, ...] = ()
