"""
===============================================================================
Score Package Compiler — Provenance Recording Service
===============================================================================
Domain: Archive / Ingestion
Description:
    Thin helper that writes `ProvenanceRecord` rows attributing a single
    field's value to its source (Claude model + prompt version, MusicBrainz
    mbid, Wikidata QID, Spotify track ID, …).

    Use exactly one of:
      * `record_ai(...)`        — value came from a Claude call
      * `record_external(...)`  — value came from an external API
      * `record_manual(...)`    — conductor edited the field by hand

    The model-version constants align with `ProvenanceSource`:
      AI_HAIKU  ↔ claude-haiku-4-5
      AI_SONNET ↔ claude-sonnet-4-6
      AI_OPUS   ↔ claude-opus-4-7

Standards: SaaS 2026, every claim is attributable.
===============================================================================
"""
from __future__ import annotations

import logging
from typing import Final
from uuid import UUID

from django.contrib.contenttypes.models import ContentType
from django.db.models import Model

from archive.models import ProvenanceRecord, ProvenanceSource

logger = logging.getLogger(__name__)


# Map of Anthropic model id → ProvenanceSource enum value.
# When a new model lands, add it here and bump the enum in models.py.
_AI_MODEL_TO_SOURCE: Final[dict[str, str]] = {
    'claude-haiku-4-5':  ProvenanceSource.AI_HAIKU,
    'claude-sonnet-4-6': ProvenanceSource.AI_SONNET,
    'claude-opus-4-7':   ProvenanceSource.AI_OPUS,
}


def record_ai(
    *,
    target: Model,
    field_name: str,
    model_id: str,
    prompt_version: str,
    confidence: float = 1.0,
) -> ProvenanceRecord:
    """Record that `target.field_name` was produced by a Claude call."""
    source = _AI_MODEL_TO_SOURCE.get(model_id)
    if source is None:
        # Unknown model id — log loudly so we notice when adding a new model.
        logger.warning("provenance.unknown_ai_model model_id=%s", model_id)
        source = ProvenanceSource.AI_OPUS  # safest default for audit purposes
    return _create(
        target=target,
        field_name=field_name,
        source=source,
        source_reference=model_id,
        confidence=confidence,
        prompt_version=prompt_version,
        model_version=model_id,
    )


def record_external(
    *,
    target: Model,
    field_name: str,
    source: str,           # ProvenanceSource enum value (MBZ / WKD / SPF / YTB / IMS)
    source_reference: str, # mbid / QID / track id / URL
    confidence: float = 1.0,
) -> ProvenanceRecord:
    """Record that `target.field_name` was sourced from an external API."""
    return _create(
        target=target,
        field_name=field_name,
        source=source,
        source_reference=source_reference,
        confidence=confidence,
        prompt_version='',
        model_version='',
    )


def record_manual(
    *,
    target: Model,
    field_name: str,
    actor_email: str = '',
) -> ProvenanceRecord:
    """Record that a human (conductor) entered `target.field_name` by hand."""
    return _create(
        target=target,
        field_name=field_name,
        source=ProvenanceSource.MANUAL,
        source_reference=actor_email,
        confidence=1.0,
        prompt_version='',
        model_version='',
    )


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _create(
    *,
    target: Model,
    field_name: str,
    source: str,
    source_reference: str,
    confidence: float,
    prompt_version: str,
    model_version: str,
) -> ProvenanceRecord:
    ct = ContentType.objects.get_for_model(target.__class__)
    if not isinstance(target.pk, UUID):
        raise TypeError(
            f"Provenance target must use a UUID primary key — got {type(target.pk).__name__} "
            f"on {target.__class__.__name__}."
        )
    return ProvenanceRecord.objects.create(
        content_type=ct,
        object_id=target.pk,
        field_name=field_name,
        source=source,
        source_reference=source_reference[:200],  # field max_length guard
        confidence=max(0.0, min(1.0, confidence)),
        prompt_version=prompt_version[:80],
        model_version=model_version[:80],
    )
