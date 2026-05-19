"""
===============================================================================
Score Package Compiler — Ingestion Service Façade
===============================================================================
Domain: Archive / Ingestion
Description:
    Thin façade the rest of the codebase uses to kick off Workflow A
    (single-edition ingestion). Views, admin actions, and management
    commands should call `start_ingestion(edition)` — never `tasks.s()`
    chains directly.

    Why a façade:
      * Hides Celery wiring details from callers.
      * Single place to enforce preconditions (status, file present, key set).
      * Single place to add metrics / Sentry breadcrumbs in Phase 6.

Standards: SaaS 2026, Service-Layer-First, fail-fast preconditions.
===============================================================================
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction

from archive.models import IngestionStatus, ScoreEdition
from archive.tasks import build_ingestion_chain

logger = logging.getLogger(__name__)


class IngestionPreconditionError(Exception):
    """Caller asked to ingest an edition that isn't in an ingestible state."""


@dataclass(frozen=True)
class IngestionTicket:
    """Returned from `start_ingestion` — opaque handle the caller can log / surface."""
    edition_id: str
    celery_task_id: str


def start_ingestion(edition: ScoreEdition, *, force: bool = False) -> IngestionTicket:
    """
    Validate preconditions, transition the edition into PENDING, and dispatch
    the Celery chain. Returns a ticket the caller can persist for tracking.

    Raises `IngestionPreconditionError` for any caller-fixable issue
    (wrong status, missing file, missing API key). Celery-side failures
    surface via the edition's `ingestion_status` + `ingestion_error` fields.

    `force=True` skips the mid-pipeline status check — useful when the
    previous chain died (Celery crash, infra outage, dead worker) and
    the row is stuck mid-status. Idempotent task bodies make duplicate
    dispatch safe — the same Movement rows / lyrics / etc. won't be
    re-created, but Anthropic calls WILL re-bill, so use deliberately.
    """
    _check_api_key()
    _check_file(edition)
    if not force:
        _check_status(edition)

    with transaction.atomic():
        # Reset state for re-ingestion paths. Cost ceiling applies per *run*,
        # so we clear the counter; provenance rows from prior runs stay.
        edition.ingestion_status = IngestionStatus.PENDING
        edition.ingestion_error = ''
        edition.ingestion_cost_cents = 0
        edition.save(update_fields=[
            'ingestion_status', 'ingestion_error',
            'ingestion_cost_cents', 'updated_at',
        ])

    chain_signature = build_ingestion_chain(edition.id)
    async_result = chain_signature.apply_async()

    logger.info(
        "ingest.dispatched edition=%s task=%s",
        edition.id, async_result.id,
    )
    return IngestionTicket(
        edition_id=str(edition.id),
        celery_task_id=async_result.id,
    )


# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------

def _check_api_key() -> None:
    if not getattr(settings, 'ANTHROPIC_API_KEY', ''):
        raise IngestionPreconditionError(
            "ANTHROPIC_API_KEY is not configured — ingestion needs Claude. "
            "Set it in the environment and restart workers."
        )


def _check_file(edition: ScoreEdition) -> None:
    if not edition.pdf_file or not edition.pdf_file.name:
        raise IngestionPreconditionError(
            f"ScoreEdition {edition.id} has no attached PDF — upload before dispatching."
        )


def _check_status(edition: ScoreEdition) -> None:
    blocking = {
        IngestionStatus.EXTRACTING,
        IngestionStatus.ENRICHING,
        IngestionStatus.GENERATING,
    }
    if edition.ingestion_status in blocking:
        raise IngestionPreconditionError(
            f"ScoreEdition {edition.id} is already mid-ingestion "
            f"(status={edition.get_ingestion_status_display()}). "
            f"Wait for it to reach AWAITING / READY / FAILED before re-running."
        )
