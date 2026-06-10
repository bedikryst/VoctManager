"""
@file dtos.py
@description Pydantic V2 boundary contracts for the messaging domain. Guarantee
             structural integrity before data reaches the service layer.
@architecture Enterprise SaaS 2026
@module messaging/dtos
"""
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import ThreadContextType

CONTEXT_TYPE_VALUES = frozenset(ThreadContextType.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value


class EnterpriseBaseDTO(BaseModel):
    """Immutable, strict base payload model."""
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)


class ThreadCreateDTO(EnterpriseBaseDTO):
    """Payload for opening a new conversation (initiated by an artist or a manager)."""
    artist_id: UUID
    sender_id: int
    subject: str = Field(..., min_length=1, max_length=160)
    body: str = Field(..., min_length=1, max_length=4000)
    context_type: str = Field(default=ThreadContextType.GENERAL)
    context_id: UUID | None = None
    assignee_id: int | None = None

    @field_validator("context_type")
    @classmethod
    def validate_context_type(cls, value: str) -> str:
        return _require_choice(value, CONTEXT_TYPE_VALUES, "context_type")


class MessageCreateDTO(EnterpriseBaseDTO):
    """Payload for posting a reply into an existing thread."""
    thread_id: UUID
    sender_id: int
    body: str = Field(..., min_length=1, max_length=4000)
