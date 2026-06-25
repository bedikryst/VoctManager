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
from django.core.cache import cache
from django.db import transaction

from archive.infrastructure.ai_client import CostCeilingExceeded
from archive.models import IngestionStatus, Piece, ScoreEdition
from archive.tasks import (
    build_ingestion_chain,
    cancel_cache_key,
    ensure_daily_budget,
    generate_program_note,
)

logger = logging.getLogger(__name__)


class IngestionPreconditionError(Exception):
    """Caller asked to ingest an edition that isn't in an ingestible state."""


def ingestion_is_available() -> bool:
    """True when the pipeline's hard configuration prerequisite — the Claude API
    key — is present. Callers use this to fail fast with a clear, non-leaky
    message *before* persisting an edition row that could never be processed
    (otherwise every upload against an unconfigured deploy leaves an orphan)."""
    return bool(getattr(settings, 'ANTHROPIC_API_KEY', ''))


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
    _check_daily_budget()
    if not force:
        _check_status(edition)

    with transaction.atomic():
        # Reset state for re-ingestion paths. The per-RUN cost ceiling applies
        # per run, so we clear that counter — but NOT the lifetime counter,
        # which records every dollar this PDF has ever cost. Provenance rows
        # from prior runs stay.
        edition.ingestion_status = IngestionStatus.PENDING
        edition.ingestion_error = ''
        edition.ingestion_progress = ''
        edition.ingestion_cost_cents = 0
        edition.save(update_fields=[
            'ingestion_status', 'ingestion_error', 'ingestion_progress',
            'ingestion_cost_cents', 'updated_at',
        ])

    # Clear any stale cancellation flag so a deliberate re-ingest of a
    # previously-cancelled edition is not immediately short-circuited.
    cache.delete(cancel_cache_key(str(edition.id)))

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


def dispatch_program_note(
    piece: Piece, *, force: bool = False, language: str | None = None,
) -> str:
    """
    Dispatch programme-note generation for a piece on demand — to regenerate the
    canonical note or produce one in another language (the ingestion chain
    already generates the default-language note eagerly). The AI cost is billed
    against the piece's default / most-recent score edition. `force=True`
    regenerates over an existing note in that language.

    Raises `IngestionPreconditionError` for caller-fixable issues (missing API
    key, no edition to bill against, daily budget exhausted). Returns the Celery
    task id.
    """
    _check_api_key()
    _check_daily_budget()
    edition = (
        piece.editions.filter(is_deleted=False)
        .order_by('-is_default', '-created_at')
        .first()
    )
    if edition is None:
        raise IngestionPreconditionError(
            "Ten utwór nie ma wgranej partytury, do której można przypisać "
            "koszt AI — najpierw wgraj PDF."
        )

    payload: dict = {'edition_id': str(edition.id), 'piece_id': str(piece.id)}
    if force:
        payload['force_program_note'] = True
    if language:
        payload['program_note_language'] = language
    async_result = generate_program_note.delay(payload)
    logger.info(
        "ingest.program_note_dispatched piece=%s edition=%s task=%s force=%s lang=%s",
        piece.id, edition.id, async_result.id, force, language or 'default',
    )
    return async_result.id


def cancel_ingestion(edition: ScoreEdition) -> None:
    """
    Cooperatively cancel an in-flight ingestion (wrong PDF, changed mind, …).

    Sets a short-lived cache flag each guarded task checks at its boundary — the
    call already in flight finishes and bills, but the chain stops there — and
    marks the edition FAILED immediately so the UI reflects the cancel at once.

    Raises `IngestionPreconditionError` if the edition is already terminal
    (nothing to cancel).
    """
    terminal = {
        IngestionStatus.AWAITING, IngestionStatus.READY, IngestionStatus.FAILED,
    }
    if edition.ingestion_status in terminal:
        raise IngestionPreconditionError(
            "To przetwarzanie już się zakończyło — nie ma czego anulować."
        )

    cache.set(cancel_cache_key(str(edition.id)), True, timeout=60 * 60)
    edition.ingestion_status = IngestionStatus.FAILED
    edition.ingestion_error = 'Przetwarzanie anulowane przez użytkownika.'
    edition.ingestion_progress = ''
    edition.save(update_fields=[
        'ingestion_status', 'ingestion_error', 'ingestion_progress', 'updated_at',
    ])
    logger.info("ingest.cancel_requested edition=%s", edition.id)


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


def _check_daily_budget() -> None:
    """Fail fast (before persisting/queueing) if the org-wide daily AI budget is
    already spent — a circuit breaker against a runaway loop draining the account."""
    try:
        ensure_daily_budget()
    except CostCeilingExceeded as exc:
        raise IngestionPreconditionError(
            "Dzienny budżet AI został wyczerpany — przetwarzanie partytur jest "
            "wstrzymane do jutra (lub podnieś INGESTION_DAILY_BUDGET_CENTS). "
            f"({exc})"
        ) from exc


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
