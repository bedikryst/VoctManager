"""
===============================================================================
Score Package Compiler — Pronunciation Guide Rules
===============================================================================
Domain: Archive / Ingestion
Description:
    What decides whether a piece's IPA guide may be re-derived, in which Latin
    system an ingestion run writes it, and how a running re-derivation reports
    back to the piece card.

      * `recompute_refusal`  — why a piece cannot be recomputed, or None. Only
        Latin carries a choice of pronunciation, and the guide is derived from
        the stored sung text, so a piece without one has nothing to transcribe.
      * `ipa_is_hand_edited` — the current guide carries a human's work (an edit
        or a click-verify). Replacing it takes an explicit yes on the card and
        is skipped by the bulk command.
      * job state — a short-lived cache entry the card polls. The call runs in
        Celery and outlives the request, and a failure there would otherwise
        reach nobody but the worker log.

    The billed AI call itself lives in `archive.tasks.recompute_piece_ipa`, next
    to the other calls that share its budget guards.

Standards: SaaS 2026, a human's correction is never overwritten silently.
===============================================================================
"""
from __future__ import annotations

from typing import Literal, TypedDict, cast
from uuid import UUID

from django.core.cache import cache

from archive.models import LatinPronunciation, Piece, ProvenanceRecord, ProvenanceSource
from archive.services.language import is_latin

DEFAULT_LATIN_SYSTEM: str = LatinPronunciation.GERMANIC

RefusalCode = Literal['not_latin', 'no_text']
JobFailure = Literal['overloaded', 'budget', 'failed']


class IpaRecomputeRefused(Exception):
    """The piece cannot have its guide re-derived; `code` says why."""

    def __init__(self, code: RefusalCode) -> None:
        super().__init__(code)
        self.code: RefusalCode = code


class IpaJob(TypedDict):
    state: Literal['running', 'failed']
    system: str
    # A `JobFailure` once failed; blank while running.
    reason: str


# A running entry must outlive the task's patient retries of an overloaded API
# (see `archive.tasks.IPA_OVERLOAD_MAX_RETRIES`); if the worker dies outright it
# is what eventually releases the card from its progress state.
_RUNNING_TTL_SECONDS = 20 * 60
_FAILED_TTL_SECONDS = 10 * 60


def recompute_refusal(piece: Piece) -> RefusalCode | None:
    if not is_latin(piece.language):
        return 'not_latin'
    if not piece.lyrics_original.strip():
        return 'no_text'
    return None


def ipa_system_for(language: str | None) -> str:
    """The system an ingestion run writes a guide in: the German default for a
    piece with Latin in it, none for any other language."""
    return DEFAULT_LATIN_SYSTEM if is_latin(language) else ''


def ipa_is_hand_edited(piece: Piece) -> bool:
    """True when the latest provenance of the guide is a human's — the same
    signal that turns the field's chip to "verified" on the card."""
    latest_source = (
        ProvenanceRecord.objects
        .filter(object_id=piece.pk, field_name='lyrics_ipa')
        .order_by('-retrieved_at')
        .values_list('source', flat=True)
        .first()
    )
    return latest_source == ProvenanceSource.MANUAL


def _job_key(piece_id: UUID | str) -> str:
    return f"archive:ipa_job:{piece_id}"


def ipa_job(piece_id: UUID | str) -> IpaJob | None:
    # Only the writers below store under this key, so a dict here is an IpaJob.
    value = cache.get(_job_key(piece_id))
    return cast(IpaJob, value) if isinstance(value, dict) else None


def mark_ipa_job_running(piece_id: UUID | str, system: str) -> None:
    job: IpaJob = {'state': 'running', 'system': system, 'reason': ''}
    cache.set(_job_key(piece_id), job, timeout=_RUNNING_TTL_SECONDS)


def mark_ipa_job_failed(piece_id: UUID | str, system: str, reason: JobFailure) -> None:
    job: IpaJob = {'state': 'failed', 'system': system, 'reason': reason}
    cache.set(_job_key(piece_id), job, timeout=_FAILED_TTL_SECONDS)


def clear_ipa_job(piece_id: UUID | str) -> None:
    cache.delete(_job_key(piece_id))
