"""
@file score_package_readiness.py
@description Per-item card readiness for the build cockpit. Translates the
    existing AI signals — ``ProvenanceRecord.confidence`` and ``is_approved`` —
    into a traffic-light per card element (🟢 ready / 🟡 low-confidence / ⚪
    missing) plus a roll-up per program item. Philosophy: warn, never block —
    a missing element is simply omitted from the card, a low-confidence one is
    flagged so it is never printed as fact without the conductor's eye.

    Provenance is loaded in two batched queries for the whole programme, so the
    cockpit read stays O(1) in round-trips regardless of repertoire size.
@architecture Enterprise SaaS 2026
@module roster/score_package_readiness
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from django.contrib.contenttypes.models import ContentType

from archive.models import Piece, ProvenanceRecord, Translation
from roster.models import ProgramItem, Project, ScorePackage
from roster.score_package_config import (
    CARD_ELEMENTS,
    resolve_card_config,
    resolve_item_edition,
    select_program_note,
    select_translation,
)

# Element-level status.
READY = "ready"
LOW = "low"
MISSING = "missing"

# Item-level roll-up.
OVERALL_READY = "ready"
OVERALL_LOW = "low"
OVERALL_INCOMPLETE = "incomplete"
OVERALL_NO_EDITION = "no_edition"

LOW_CONFIDENCE_THRESHOLD = 0.5

# (object_id, field_name) -> latest provenance confidence.
ProvenanceMap = dict[tuple[Any, str], float]


def _field_status(present: bool, confidence: float | None) -> str:
    """A single field's traffic light from presence + AI confidence. ``None``
    confidence means the value is trusted (manual entry / external API / no AI)."""
    if not present:
        return MISSING
    if confidence is not None and confidence < LOW_CONFIDENCE_THRESHOLD:
        return LOW
    return READY


def _load_provenance(content_type: ContentType, object_ids: Iterable[Any]) -> ProvenanceMap:
    """Latest-wins confidence per (object, field) for one content type."""
    ids = list(object_ids)
    result: ProvenanceMap = {}
    if not ids:
        return result
    records = (
        ProvenanceRecord.objects
        .filter(content_type=content_type, object_id__in=ids)
        .order_by("retrieved_at")
        .values_list("object_id", "field_name", "confidence")
    )
    for object_id, field_name, confidence in records:
        result[(object_id, field_name)] = confidence
    return result


def _element_statuses(
    item: ProgramItem,
    project: Project,
    piece_prov: ProvenanceMap,
    tr_prov: ProvenanceMap,
    language: str,
) -> dict[str, str]:
    """Compute the traffic light for every canonical card element of one item."""
    piece = item.piece

    # eyebrow — the section/text-source line.
    if item.section_label:
        eyebrow = READY
    else:
        eyebrow = _field_status(
            bool(piece.text_source), piece_prov.get((piece.pk, "text_source"))
        )

    # meta — voicing · language · duration. Confidence is the weakest of the
    # AI-sourced fields that are actually present.
    meta_present = bool(piece.voicing or piece.language or piece.estimated_duration)
    meta_confidences = [
        piece_prov[key]
        for key in ((piece.pk, "voicing"), (piece.pk, "language"))
        if key in piece_prov
    ]
    meta_conf = min(meta_confidences) if meta_confidences else None
    meta = _field_status(meta_present, meta_conf)

    # text — original sung text (override always trusted).
    if item.text_override:
        text = READY
    else:
        text = _field_status(
            bool(piece.lyrics_original), piece_prov.get((piece.pk, "lyrics_original"))
        )

    # translation — selected piece-level translation in the package language.
    translation_obj = select_translation(piece, language)
    if translation_obj is not None and (translation_obj.text or "").strip():
        translation = _field_status(
            True, tr_prov.get((translation_obj.pk, "text"))
        )
    else:
        translation = MISSING

    # note — programme note (override always trusted; otherwise approval gates it).
    if item.note_override:
        note = READY
    else:
        note_obj = select_program_note(piece, project, language)
        if note_obj is not None and (note_obj.content or "").strip():
            note = READY if note_obj.is_approved else LOW
        else:
            note = MISSING

    # ipa — pronunciation aid.
    ipa = _field_status(bool(piece.lyrics_ipa), piece_prov.get((piece.pk, "lyrics_ipa")))

    return {
        "eyebrow": eyebrow,
        "meta": meta,
        "text": text,
        "translation": translation,
        "note": note,
        "ipa": ipa,
    }


def _rollup(statuses: dict[str, str], enabled: frozenset[str], has_edition: bool) -> str:
    """Item-level badge: edition gaps dominate, then low-confidence, then missing."""
    if not has_edition:
        return OVERALL_NO_EDITION
    relevant = [statuses[key] for key in CARD_ELEMENTS if key in enabled]
    if any(s == LOW for s in relevant):
        return OVERALL_LOW
    if any(s == MISSING for s in relevant):
        return OVERALL_INCOMPLETE
    return OVERALL_READY


def compute_program_readiness(
    project: Project,
    items: list[ProgramItem],
    package: ScorePackage,
) -> dict[Any, dict[str, Any]]:
    """Readiness for every program item, keyed by item id. Two batched provenance
    queries serve the whole programme."""
    language = package.translation_language

    piece_ids = {item.piece_id for item in items}
    # Selected translations drive the translation light; collect their ids up front.
    translation_ids = set()
    for item in items:
        chosen = select_translation(item.piece, language)
        if chosen is not None:
            translation_ids.add(chosen.pk)

    piece_ct = ContentType.objects.get_for_model(Piece)
    tr_ct = ContentType.objects.get_for_model(Translation)
    piece_prov = _load_provenance(piece_ct, piece_ids)
    tr_prov = _load_provenance(tr_ct, translation_ids)

    result: dict[Any, dict[str, Any]] = {}
    for item in items:
        config = resolve_card_config(item, package)
        statuses = _element_statuses(item, project, piece_prov, tr_prov, language)
        has_edition = resolve_item_edition(item) is not None
        result[item.pk] = {
            "overall": _rollup(statuses, config.elements if config.enabled else frozenset(), has_edition),
            "elements": statuses,
        }
    return result


__all__ = [
    "LOW",
    "MISSING",
    "OVERALL_INCOMPLETE",
    "OVERALL_LOW",
    "OVERALL_NO_EDITION",
    "OVERALL_READY",
    "READY",
    "compute_program_readiness",
]
