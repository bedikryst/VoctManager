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

    `ProvenanceSource` records the model TIER (Haiku / Sonnet / Opus), never the
    exact version — the precise id of the model that produced a value lives in
    each row's `model_version`. That split is what lets a model upgrade land
    without a data migration; see `_AI_MODEL_TO_SOURCE` below.

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


# Map of Anthropic model id → ProvenanceSource tier.
#
# EVERY model id the pipeline can emit must appear here. A miss is not benign:
# `record_ai` falls back to AI_OPUS, so an unmapped id silently attributes the
# value to the wrong tier in the review cockpit while `model_version` says
# something else. Superseded ids stay mapped so a model rollback — or a
# re-render of historical rows — keeps attributing correctly.
_AI_MODEL_TO_SOURCE: Final[dict[str, str]] = {
    'claude-haiku-4-5':  ProvenanceSource.AI_HAIKU,
    'claude-sonnet-5':   ProvenanceSource.AI_SONNET,
    'claude-opus-5':     ProvenanceSource.AI_OPUS,
    # Superseded — kept for rollback and for re-runs pinned to the old tier.
    'claude-sonnet-4-6': ProvenanceSource.AI_SONNET,
    'claude-opus-4-8':   ProvenanceSource.AI_OPUS,
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
        # A miss means this row is about to be attributed to the wrong tier —
        # error level, because the only fix is a code change in the map above.
        logger.error(
            "provenance.unknown_ai_model model_id=%s — attributing to AI_OPUS; "
            "add it to _AI_MODEL_TO_SOURCE",
            model_id,
        )
        source = ProvenanceSource.AI_OPUS
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
