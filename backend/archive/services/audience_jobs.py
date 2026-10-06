"""
===============================================================================
Score Package Compiler — Audience-Material Job State
===============================================================================
Domain: Archive / Ingestion
Description:
    How an on-demand programme note or prose translation, running in Celery,
    reports back to the review cockpit: a short-lived cache entry per piece and
    kind that the cockpit polls until it clears (done) or turns failed. The
    contract is the pronunciation recompute's (`archive.services.ipa`); without
    it a failure reaches nobody but the worker log.

    One entry per kind, not per language: the dispatchers refuse a second job
    of a kind while the first runs, so two calls never bill for the same row.

Standards: SaaS 2026, every exit of a job is visible to whoever started it.
===============================================================================
"""
from __future__ import annotations

from typing import Literal, TypedDict, cast
from uuid import UUID

from django.core.cache import cache

from archive.services.ipa import JobFailure

AudienceJobKind = Literal['program_note', 'translation']


class AudienceJob(TypedDict):
    state: Literal['running', 'failed']
    language: str
    # A `JobFailure` once failed; blank while running.
    reason: str


# A running entry must outlive the tasks' patient retries of an overloaded API
# (`archive.tasks.IPA_OVERLOAD_MAX_RETRIES`); if the worker dies outright it is
# what eventually releases the cockpit from its progress state.
_RUNNING_TTL_SECONDS = 20 * 60
_FAILED_TTL_SECONDS = 10 * 60


def _job_key(kind: AudienceJobKind, piece_id: UUID | str) -> str:
    return f"archive:{kind}_job:{piece_id}"


def audience_job(kind: AudienceJobKind, piece_id: UUID | str) -> AudienceJob | None:
    # Only the writers below store under this key, so a dict here is an AudienceJob.
    value = cache.get(_job_key(kind, piece_id))
    return cast(AudienceJob, value) if isinstance(value, dict) else None


def audience_job_running(kind: AudienceJobKind, piece_id: UUID | str) -> bool:
    job = audience_job(kind, piece_id)
    return job is not None and job['state'] == 'running'


def mark_audience_job_running(
    kind: AudienceJobKind, piece_id: UUID | str, language: str,
) -> None:
    job: AudienceJob = {'state': 'running', 'language': language, 'reason': ''}
    cache.set(_job_key(kind, piece_id), job, timeout=_RUNNING_TTL_SECONDS)


def mark_audience_job_failed(
    kind: AudienceJobKind, piece_id: UUID | str, language: str, reason: JobFailure,
) -> None:
    job: AudienceJob = {'state': 'failed', 'language': language, 'reason': reason}
    cache.set(_job_key(kind, piece_id), job, timeout=_FAILED_TTL_SECONDS)


def clear_audience_job(kind: AudienceJobKind, piece_id: UUID | str) -> None:
    cache.delete(_job_key(kind, piece_id))
