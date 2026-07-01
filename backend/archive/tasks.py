"""
===============================================================================
Score Package Compiler — Celery Ingestion Tasks (Workflow A, v2)
===============================================================================
Domain: Archive / Ingestion
Description:
    The single-edition ingestion chain. Public entrypoint:
    `archive.services.ingestion.start_ingestion(edition)` — do NOT call these
    tasks directly from views; use the service façade.

    v2 chain (native-PDF, consolidated):
        prepare_document            (sha256 + page count; NO text-layer gate)
          → analyze_score           (Claude — Sonnet, reads the WHOLE PDF by
                                      vision: identity + movements + sung text
                                      + IPA + translations in ONE call)
          → resolve_composer_and_piece  (MusicBrainz + Wikidata + DB dedup)
          → persist_analysis        (write movements / lyrics / translations)
          → generate_program_note   (Claude — Sonnet, text-only)
          → lookup_spotify
          → lookup_youtube
          → finalize_edition

    Why the rewrite (vs the old 4-call text-only chain):
      * One vision call over the real document — handles scans, full pages,
        and true layout — instead of three calls fed garbled pypdf text from
        only the first three pages. Fewer calls = fewer points to overload.
      * Resilience: a transient `overloaded_error` (HTTP 529) is retried
        *patiently* (tens of seconds → minutes) and surfaced as a
        WAITING_OVERLOAD step, NEVER hammered then failed. 529s are unbilled.
      * Cost governance: every Claude charge is billed to BOTH the per-run
        counter (enforces the run ceiling) AND a never-reset lifetime counter,
        plus an org-wide daily budget — so a PDF can't silently drain the
        account by being re-processed.

    Design rules (unchanged):
      * Each task is idempotent and safe to retry from any step.
      * `payload['_aborted'] = True` short-circuits downstream tasks; only
        `finalize_edition` always runs, to guarantee a terminal status.

Standards: SaaS 2026, Celery 5.3, native-PDF vision, overload-aware.
===============================================================================
"""
from __future__ import annotations

import functools
import logging
import random
from collections.abc import Callable
from typing import Any, BinaryIO, cast
from uuid import UUID

from celery import chain, shared_task
from celery.exceptions import MaxRetriesExceededError
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from archive.dtos import (
    ExtractedWorkIdentity,
    GeneratedProgramNote,
    ScoreAnalysisResult,
)
from archive.infrastructure.ai_client import (
    AIClient,
    AIClientError,
    AIClientOverloadedError,
    AIClientPermanentError,
    AIClientTruncatedError,
    AIModel,
    CostCeilingExceeded,
)
from archive.infrastructure.musicbrainz_client import MusicBrainzClient
from archive.infrastructure.pdf_extractor import (
    ExtractedPdf,
    PdfExtractionError,
)
from archive.infrastructure.pdf_extractor import (
    extract as extract_pdf,
)
from archive.infrastructure.prompts import (
    ANALYZE_SCORE,
    GENERATE_PROGRAM_NOTE,
)
from archive.infrastructure.spotify_client import SpotifyClient
from archive.infrastructure.wikidata_client import WikidataClient
from archive.infrastructure.youtube_client import YouTubeClient
from archive.models import (
    IngestionProgress,
    IngestionStatus,
    Movement,
    Piece,
    ProgramNote,
    Recording,
    RecordingSource,
    ScoreEdition,
    Translation,
)
from archive.services import provenance
from archive.services.language import normalize_language
from archive.services.resolvers import (
    resolve_or_create_composer,
    resolve_or_create_piece,
)

logger = logging.getLogger(__name__)

# Confidence below this aborts with FAILED — the PDF is probably not a score.
MIN_IDENTITY_CONFIDENCE: float = 0.5

# Hard page cap. Anthropic's native-PDF support tops out around 100 pages; a
# score longer than this should be split, not silently truncated.
MAX_PDF_PAGES: int = 100

# Output budget for the consolidated analysis (sung text + line-aligned IPA +
# 2 translations + adaptive thinking, all sharing `max_tokens`). The client
# escalates toward the model's 64K cap on truncation rather than failing.
ANALYZE_MAX_TOKENS: int = 32768
PROGRAM_NOTE_MAX_TOKENS: int = 8192

# The canonical programme note is generated eagerly in the ensemble's language.
# Polish is the platform's primary language; the cockpit can request others.
DEFAULT_PROGRAM_NOTE_LANGUAGE: str = 'pl'
DEFAULT_PROGRAM_NOTE_TONE: str = 'accessible'

# Two-tier retry policy. Overload (529) is patient — Anthropic-wide capacity
# blips clear in seconds to minutes, and failing the edition just makes the
# conductor re-upload. Other transient blips (DB, external HTTP) get a shorter,
# smaller budget before we give up and mark FAILED.
OVERLOAD_MAX_RETRIES: int = 6      # 30,60,120,240,480,600s ≈ up to ~25 min
OVERLOAD_BASE_DELAY: float = 30.0
OVERLOAD_MAX_DELAY: float = 600.0
TRANSIENT_MAX_RETRIES: int = 3     # 5,10,20s
TRANSIENT_BASE_DELAY: float = 5.0
TRANSIENT_MAX_DELAY: float = 120.0


# ===========================================================================
# Public chain builder — called from the service façade
# ===========================================================================

def build_ingestion_chain(edition_id: UUID) -> Any:
    """
    Build (but do not apply) the full ingestion chain for one ScoreEdition.
    Caller (`services.ingestion.start_ingestion`) applies it.
    """
    eid = str(edition_id)
    # The programme note is deliberately NOT in this chain. It used to run
    # eagerly, but that generated prose from the AI's *un-reviewed* identity —
    # baking a wrong composer/epoch/title straight into the audience note. It is
    # now generated on demand from the review cockpit (or on Approve), AFTER the
    # conductor has verified the identity, with the corrected metadata AND the
    # sung text as context — see `generate_program_note` /
    # `services.ingestion.dispatch_program_note`.
    return chain(
        prepare_document.s({'edition_id': eid}),
        analyze_score.s(),
        resolve_composer_and_piece.s(),
        persist_analysis.s(),
        lookup_spotify.s(),
        lookup_youtube.s(),
        finalize_edition.s(),
    )


# ===========================================================================
# Retry / failure plumbing
# ===========================================================================

def _backoff(retries: int, base: float, cap: float) -> float:
    """Exponential backoff with full jitter."""
    return min(cap, base * (2 ** retries)) * (0.5 + random.random() / 2)


def cancel_cache_key(edition_id: str) -> str:
    """Redis key the guard polls to cooperatively stop an in-flight chain.
    Set by `services.ingestion.cancel_ingestion`, cleared on (re)dispatch."""
    return f"ingest:cancel:{edition_id}"


def _retry_or_fail(
    self,
    payload: dict,
    exc: Exception,
    *,
    reason: str,
    max_retries: int,
    base_delay: float,
    max_delay: float,
    progress: str = '',
) -> dict:
    """
    Schedule a patient retry of the current task, or — once the budget is
    exhausted — mark the edition FAILED with `reason` and abort the chain.

    Raising `self.retry(...)` either reschedules (propagates `Retry`) or raises
    `MaxRetriesExceededError`, which we convert into a graceful terminal state.
    """
    edition_id = payload['edition_id']
    if progress:
        _set_progress(edition_id, progress)
    countdown = _backoff(self.request.retries, base_delay, max_delay)
    logger.warning(
        "ingest.retry task=%s edition=%s attempt=%d countdown=%.0fs reason=%s",
        self.name, edition_id, self.request.retries + 1, countdown, exc,
    )
    try:
        raise self.retry(exc=exc, countdown=countdown, max_retries=max_retries)
    except MaxRetriesExceededError:
        edition = _load_edition(edition_id)
        return _fail(edition, reason, payload)


def _guarded(func: Callable) -> Callable:
    """
    Wrap a chain task body with the full error contract:

      * upstream-abort short-circuit (`payload['_aborted']`)
      * CostCeilingExceeded / AIClientPermanentError / AIClientTruncatedError
        → terminal FAILED (truncation bills the attempts first)
      * AIClientOverloadedError → PATIENT retry (529/5xx/429/timeout), surfaced
        as a WAITING_OVERLOAD step; FAILED only after the patient budget runs
        out. Never billed.
      * any other AIClientError / unexpected Exception → short retry, then FAILED
        — guaranteeing every guarded task reaches a terminal state rather than
        leaving the edition stuck mid-pipeline.
    """
    @functools.wraps(func)
    def wrapper(self, payload: dict) -> dict:
        edition_id = payload.get('edition_id')
        # Cooperative cancellation: the conductor hit "cancel" (wrong PDF, etc.).
        # The edition was already marked FAILED by the service; we just stop the
        # chain here so no further AI money is spent. A call already in flight
        # finishes and bills, but nothing downstream of this boundary runs.
        if edition_id and cache.get(cancel_cache_key(str(edition_id))):
            logger.info(
                "ingest.cancelled task=%s edition=%s — short-circuit",
                func.__name__, edition_id,
            )
            payload['_aborted'] = True
            return payload
        if payload.get('_aborted'):
            logger.info(
                "ingest.skip task=%s edition=%s reason=upstream_aborted",
                func.__name__, edition_id,
            )
            return payload
        try:
            return func(self, payload)
        except CostCeilingExceeded as exc:
            edition = _load_edition(payload['edition_id'])
            return _fail(edition, f'cost_ceiling_exceeded: {exc}', payload)
        except AIClientPermanentError as exc:
            edition = _load_edition(payload['edition_id'])
            logger.error(
                "ingest.ai_permanent task=%s edition=%s err=%s",
                func.__name__, payload['edition_id'], exc,
            )
            return _fail(edition, f'ai_request_rejected: {exc}', payload)
        except AIClientTruncatedError as exc:
            edition = _load_edition(payload['edition_id'])
            if exc.cost is not None:
                _bill_edition(edition, exc.cost.total_cents)
            logger.error(
                "ingest.ai_truncated task=%s edition=%s cost_cents=%s err=%s",
                func.__name__, payload['edition_id'],
                exc.cost.total_cents if exc.cost else 0, exc,
            )
            return _fail(edition, f'ai_output_truncated: {exc}', payload)
        except AIClientOverloadedError as exc:
            # 529 / transient capacity. Unbilled. Wait patiently — this is the
            # fix for the production retry-storm that hammered then died.
            return _retry_or_fail(
                self, payload, exc,
                reason=(
                    'api_overloaded — usługa AI była przeciążona przez dłuższą '
                    'chwilę. Spróbuj ponowić przetwarzanie później.'
                ),
                max_retries=OVERLOAD_MAX_RETRIES,
                base_delay=OVERLOAD_BASE_DELAY,
                max_delay=OVERLOAD_MAX_DELAY,
                progress=IngestionProgress.WAITING_OVERLOAD,
            )
        except AIClientError as exc:
            # Reached Anthropic and billed, but not a known-terminal class.
            if exc.cost is not None:
                edition = _load_edition(payload['edition_id'])
                _bill_edition(edition, exc.cost.total_cents)
            return _retry_or_fail(
                self, payload, exc,
                reason=f'ai_error: {exc}',
                max_retries=TRANSIENT_MAX_RETRIES,
                base_delay=TRANSIENT_BASE_DELAY,
                max_delay=TRANSIENT_MAX_DELAY,
            )
        except Exception as exc:  # last-resort infra resilience → terminal state
            return _retry_or_fail(
                self, payload, exc,
                reason=f'unexpected_error: {exc.__class__.__name__}: {exc}',
                max_retries=TRANSIENT_MAX_RETRIES,
                base_delay=TRANSIENT_BASE_DELAY,
                max_delay=TRANSIENT_MAX_DELAY,
            )

    return wrapper


# `bind=True` only — all retry/abort logic lives in `_guarded` / `_retry_or_fail`
# so overload (patient) and infra (short) blips get different backoff policies.
_TASK_KW = dict(bind=True, max_retries=OVERLOAD_MAX_RETRIES)


# ===========================================================================
# Tasks
# ===========================================================================

@shared_task(name='archive.prepare_document', **_TASK_KW)
@_guarded
def prepare_document(self, payload: dict) -> dict:
    """Phase 1 — hash + page-count the PDF. No text-layer gate: scans are valid
    input now that the model reads the document by vision."""
    edition = _load_edition(payload['edition_id'])
    edition.ingestion_status = IngestionStatus.EXTRACTING
    edition.ingestion_progress = IngestionProgress.PREPARING
    edition.save(update_fields=['ingestion_status', 'ingestion_progress', 'updated_at'])

    try:
        with edition.pdf_file.open('rb') as fh:
            result: ExtractedPdf = extract_pdf(cast("BinaryIO", fh))
    except PdfExtractionError as exc:
        return _fail(edition, f'pdf_extraction_failed: {exc}', payload)

    if result.page_count > MAX_PDF_PAGES:
        return _fail(
            edition,
            f'pdf_too_large: {result.page_count} stron (limit {MAX_PDF_PAGES}). '
            f'Podziel partyturę na mniejsze pliki.',
            payload,
        )

    update_fields: list[str] = ['updated_at']
    if not edition.sha256:
        edition.sha256 = result.sha256
        update_fields.append('sha256')
    if not edition.page_count:
        edition.page_count = result.page_count
        update_fields.append('page_count')
    edition.save(update_fields=update_fields)

    # Re-upload dedup: an identical PDF (same SHA-256) that already resolved to a
    # piece needs no second AI run — attach this edition to that piece and skip
    # straight to conductor review. `_aborted` short-circuits the guarded AI
    # tasks; because we set AWAITING (not FAILED), `finalize_edition` still
    # confirms the terminal state. Only for fresh uploads (no pre-attached
    # piece), and only against a twin that already reached AWAITING / READY.
    if edition.piece_id is None and result.sha256:
        twin = (
            ScoreEdition.objects
            .filter(
                sha256=result.sha256,
                piece__isnull=False,
                ingestion_status__in=[
                    IngestionStatus.AWAITING, IngestionStatus.READY,
                ],
            )
            .exclude(pk=edition.pk)
            .order_by('-created_at')
            .first()
        )
        if twin is not None:
            edition.piece_id = twin.piece_id
            edition.ingestion_status = IngestionStatus.AWAITING
            edition.ingestion_progress = ''
            edition.save(update_fields=[
                'piece_id', 'ingestion_status', 'ingestion_progress', 'updated_at',
            ])
            logger.info(
                "ingest.dedup edition=%s sha256=%s matched piece=%s — skipping AI",
                edition.id, result.sha256[:12], twin.piece_id,
            )
            payload['page_count'] = result.page_count
            payload['piece_id'] = str(twin.piece_id)
            payload['_aborted'] = True
            return payload

    payload['page_count'] = result.page_count
    return payload


@shared_task(name='archive.analyze_score', **_TASK_KW)
@_guarded
def analyze_score(self, payload: dict) -> dict:
    """Phase 2 — ONE Sonnet vision call reads the whole PDF and returns the full
    record: identity + movements + sung text + IPA + translations."""
    edition = _load_edition(payload['edition_id'])
    _ensure_budget(edition)
    edition.ingestion_status = IngestionStatus.GENERATING
    edition.ingestion_progress = IngestionProgress.ANALYZING
    edition.save(update_fields=['ingestion_status', 'ingestion_progress', 'updated_at'])

    # Default audience languages; configurable per ensemble in a later phase.
    target_languages = ['en', 'pl']
    instructions = (
        "Analyse the attached score PDF. Provide prose translations of the sung "
        f"text into these target languages: {', '.join(target_languages)}."
    )

    with edition.pdf_file.open('rb') as fh:
        pdf_bytes = fh.read()

    client = AIClient()
    # `structured=False`: the consolidated schema (identity + movements + text +
    # IPA + translations) is too large for the SDK's strict `output_format`
    # validator — Anthropic rejects it with 400 "Schema is too complex". We send
    # the JSON Schema in the prompt and parse the model's JSON ourselves instead.
    analysis, cost = client.parse(
        model=AIModel.SONNET,
        prompt=ANALYZE_SCORE,
        user_content=instructions,
        output_schema=ScoreAnalysisResult,
        max_tokens=ANALYZE_MAX_TOKENS,
        effort="medium",
        pdf_bytes=pdf_bytes,
        structured=False,
    )
    _bill_edition(edition, cost.total_cents)

    if analysis.confidence < MIN_IDENTITY_CONFIDENCE:
        return _fail(
            edition,
            f'low_confidence: {analysis.confidence:.2f} — to może nie być '
            f'partytura albo skan jest nieczytelny. Sprawdź plik i wgraj ponownie.',
            payload,
        )

    payload['analysis'] = analysis.model_dump(mode='json')
    payload['analysis_prompt_version'] = ANALYZE_SCORE.version
    return payload


@shared_task(name='archive.resolve_composer_and_piece', **_TASK_KW)
@_guarded
def resolve_composer_and_piece(self, payload: dict) -> dict:
    """Phase 3 — canonicalize via MusicBrainz + Wikidata, then dedup against DB.

    Fast path: a pre-attached `piece_id` (uploading another edition of a known
    work) trusts the FK and skips the resolver.
    """
    edition = _load_edition(payload['edition_id'])
    edition.ingestion_status = IngestionStatus.ENRICHING
    edition.ingestion_progress = IngestionProgress.RESOLVING
    edition.save(update_fields=['ingestion_status', 'ingestion_progress', 'updated_at'])

    if edition.piece is not None:
        payload['piece_id'] = str(edition.piece.id)
        payload['composer_id'] = (
            str(edition.piece.composer_id) if edition.piece.composer_id else ''
        )
        logger.info(
            "ingest.resolver_skipped edition=%s piece=%s reason=pre_attached",
            edition.id, edition.piece.id,
        )
        return payload

    extracted = _identity_from_analysis(payload['analysis'])

    mbz_work = MusicBrainzClient.search_work(
        title=extracted.title,
        composer_name=extracted.composer_full_name or None,
    )
    mbz_composer = None
    if mbz_work and mbz_work.composer_mbid:
        mbz_composer = MusicBrainzClient.search_composer(
            name=mbz_work.composer_name or extracted.composer_full_name,
        )
    elif extracted.composer_full_name:
        mbz_composer = MusicBrainzClient.search_composer(name=extracted.composer_full_name)

    wiki_composer = None
    if mbz_composer and mbz_composer.mbid:
        wiki_composer = WikidataClient.enrich_composer_by_mbid(mbz_composer.mbid)
    elif extracted.composer_full_name:
        wiki_composer = WikidataClient.enrich_composer_by_name(extracted.composer_full_name)

    composer_outcome = resolve_or_create_composer(
        extracted=extracted,
        mbz_result=mbz_composer,
        wiki_result=wiki_composer,
    )
    piece_outcome = resolve_or_create_piece(
        composer_id=composer_outcome.entity_id,
        extracted=extracted,
        mbz_work=mbz_work,
    )

    if edition.piece_id != piece_outcome.entity_id:
        edition.piece_id = piece_outcome.entity_id
        edition.save(update_fields=['piece_id', 'updated_at'])

    logger.info(
        "ingest.resolved edition=%s composer=%s (created=%s) piece=%s (created=%s)",
        edition.id, composer_outcome.entity_id, composer_outcome.created,
        piece_outcome.entity_id, piece_outcome.created,
    )

    payload['piece_id'] = str(piece_outcome.entity_id)
    payload['composer_id'] = str(composer_outcome.entity_id)
    return payload


@shared_task(name='archive.persist_analysis', **_TASK_KW)
@_guarded
def persist_analysis(self, payload: dict) -> dict:
    """Phase 4 — persist the movements, sung text, IPA and translations that the
    single analysis call produced. No AI here; idempotent."""
    _set_progress(payload['edition_id'], IngestionProgress.PERSISTING)
    piece = Piece.objects.get(id=payload['piece_id'])
    analysis = ScoreAnalysisResult.model_validate(payload['analysis'])
    version = payload.get('analysis_prompt_version', ANALYZE_SCORE.version)

    with transaction.atomic():
        # Movements (skip if already populated).
        if not piece.movements.exists() and analysis.movements:
            for mv in analysis.movements:
                movement = Movement.objects.create(
                    piece=piece,
                    order_index=mv.order_index,
                    title=mv.title,
                    tempo_marking=mv.tempo_marking or '',
                    starts_on_page=mv.starts_on_page,
                )
                provenance.record_ai(
                    target=movement, field_name='title',
                    model_id=AIModel.SONNET, prompt_version=version,
                    confidence=analysis.confidence,
                )

        # Sung text / IPA / language (fill only blanks).
        update_fields: list[str] = ['updated_at']
        if not piece.lyrics_original and analysis.sung_text:
            piece.lyrics_original = analysis.sung_text
            update_fields.append('lyrics_original')
            provenance.record_ai(
                target=piece, field_name='lyrics_original',
                model_id=AIModel.SONNET, prompt_version=version,
                confidence=analysis.confidence,
            )
        if not piece.lyrics_ipa and analysis.ipa_transcription:
            piece.lyrics_ipa = analysis.ipa_transcription
            update_fields.append('lyrics_ipa')
            provenance.record_ai(
                target=piece, field_name='lyrics_ipa',
                model_id=AIModel.SONNET, prompt_version=version,
                confidence=analysis.confidence,
            )
        # Language is a SUNG-TEXT property, so `persist_analysis` is its sole
        # writer — the resolver no longer touches `piece.language`. Both AI
        # fields (ISO `sung_text_language` and the word-form `language`) funnel
        # through `normalize_language`, so the stored value is always a canonical
        # ISO 639-1 code ('pl', 'la', or 'pl+la' for a bilingual score) instead
        # of the "Polish / polski / pol / Polish+Latin" free-text mess.
        normalized_language = normalize_language(
            analysis.sung_text_language or analysis.language
        )
        if not piece.language and normalized_language:
            piece.language = normalized_language
            update_fields.append('language')
            provenance.record_ai(
                target=piece, field_name='language',
                model_id=AIModel.SONNET, prompt_version=version,
                confidence=analysis.confidence,
            )
        piece.save(update_fields=update_fields)

        # Translations (skip languages already present).
        existing_langs = set(
            piece.translations.values_list('target_language', flat=True)
        )
        for tr in analysis.translations:
            if tr.target_language in existing_langs:
                continue
            translation = Translation.objects.create(
                piece=piece,
                target_language=tr.target_language,
                text=tr.text,
                is_singable=tr.is_singable,
            )
            provenance.record_ai(
                target=translation, field_name='text',
                model_id=AIModel.SONNET, prompt_version=version,
                confidence=analysis.confidence,
            )

    # The full analysis (sung text + line-aligned IPA + translations) is now
    # persisted. Drop it from the Celery payload so the four remaining tasks
    # don't drag a multi-KB blob through the result backend on every hop — and
    # don't dump it into the worker log on every `task succeeded` line.
    payload.pop('analysis', None)
    payload.pop('analysis_prompt_version', None)
    return payload


@shared_task(name='archive.generate_program_note', **_TASK_KW)
@_guarded
def generate_program_note(self, payload: dict) -> dict:
    """Claude writes a ~250-word audience programme note (text-only).

    Generated on demand from the review cockpit AFTER the conductor has verified
    the identity (via `services.ingestion.dispatch_program_note`), in the
    ensemble's language (`DEFAULT_PROGRAM_NOTE_LANGUAGE`) by default. Pass
    `program_note_language` and `force_program_note=True` in the payload to
    produce another language or regenerate.

    The call is fed the piece's actual musical context (text source, key,
    voicing, epoch) AND an excerpt of the printed sung text, so the note can be
    anchored in the real work instead of the model's (often absent) training
    knowledge of an obscure arrangement — the cause of the thin, stub notes.
    """
    edition = _load_edition(payload['edition_id'])
    _ensure_budget(edition)
    piece = Piece.objects.get(id=payload['piece_id'])

    language = payload.get('program_note_language') or DEFAULT_PROGRAM_NOTE_LANGUAGE
    tone = payload.get('program_note_tone') or DEFAULT_PROGRAM_NOTE_TONE

    existing = ProgramNote.objects.filter(
        piece=piece, project__isnull=True, language=language,
    )
    if existing.exists():
        if not payload.get('force_program_note'):
            return payload
        # Regenerate: soft-delete the stale note so they don't accumulate.
        existing.delete()

    composer = piece.composer
    composer_name = ''
    if composer:
        composer_name = f"{composer.first_name} {composer.last_name}".strip()

    epoch_label = piece.get_epoch_display() if piece.epoch else 'unknown'
    # A bounded excerpt of the printed text: enough to ground the note, small
    # enough not to blow the token budget on a long anthem.
    sung_text_excerpt = (piece.lyrics_original or '').strip()[:1200]

    user_content = (
        f"Composer: {composer_name or 'Unknown'}\n"
        f"Arranger: {piece.arranger or '—'}\n"
        f"Work title: {piece.title}\n"
        f"Year of composition: {piece.composition_year or 'unknown'}\n"
        f"Stylistic origin / epoch: {epoch_label}\n"
        f"Voicing: {piece.voicing or 'unknown'}\n"
        f"Musical key: {piece.musical_key or 'unknown'}\n"
        f"Sung language: {piece.language or 'unknown'}\n"
        f"Text source: {piece.text_source or 'unknown'}\n"
        f"Printed sung text (excerpt, may be truncated):\n"
        f"{sung_text_excerpt or '(not available)'}\n\n"
        f"Target tone: {tone}\n"
        f"Target word count: 250\n"
        f"Target language: {language}"
    )

    client = AIClient()
    # A programme note is prose, not a reasoning task: extended thinking just ate
    # the shared `max_tokens` budget and left too little for the output (the
    # stub-note bug). Disable thinking so the whole budget is the note, and keep
    # a moderate effort for quality.
    result, cost = client.parse(
        model=AIModel.SONNET,
        prompt=GENERATE_PROGRAM_NOTE,
        user_content=user_content,
        output_schema=GeneratedProgramNote,
        max_tokens=PROGRAM_NOTE_MAX_TOKENS,
        effort="medium",
        enable_thinking=False,
    )
    _bill_edition(edition, cost.total_cents)

    note = ProgramNote.objects.create(
        piece=piece,
        project=None,
        language=language,
        target_tone=tone,
        word_count_target=250,
        content=result.content,
    )
    provenance.record_ai(
        target=note, field_name='content',
        model_id=AIModel.SONNET,
        prompt_version=GENERATE_PROGRAM_NOTE.version,
    )
    return payload


@shared_task(name='archive.lookup_spotify', **_TASK_KW)
@_guarded
def lookup_spotify(self, payload: dict) -> dict:
    """Phase 6 — Spotify recording search; up to 5 candidates persisted."""
    _set_progress(payload['edition_id'], IngestionProgress.RECORDINGS)
    piece = Piece.objects.get(id=payload['piece_id'])
    composer_name = _composer_name(piece)
    search = SpotifyClient.search_recordings(
        composer_name=composer_name,
        work_title=piece.title,
        limit=5,
    )
    _persist_recordings(piece=piece, source_enum=RecordingSource.SPOTIFY, search=search)
    return payload


@shared_task(name='archive.lookup_youtube', **_TASK_KW)
@_guarded
def lookup_youtube(self, payload: dict) -> dict:
    """Phase 7 — YouTube video search; up to 5 candidates persisted."""
    piece = Piece.objects.get(id=payload['piece_id'])
    composer_name = _composer_name(piece)
    search = YouTubeClient.search_videos(
        composer_name=composer_name,
        work_title=piece.title,
        limit=5,
    )
    _persist_recordings(piece=piece, source_enum=RecordingSource.YOUTUBE, search=search)
    return payload


@shared_task(name='archive.finalize_edition', **_TASK_KW)
def finalize_edition(self, payload: dict) -> dict:
    """
    Phase 8 — flip the edition to AWAITING conductor review.
    NOT guarded: always runs, even after an upstream abort, so every chain
    produces a terminal status (FAILED was already set by `_fail`).
    """
    edition = _load_edition(payload['edition_id'])
    if edition.ingestion_status == IngestionStatus.FAILED:
        return payload
    edition.ingestion_status = IngestionStatus.AWAITING
    edition.ingestion_progress = ''
    edition.save(update_fields=['ingestion_status', 'ingestion_progress', 'updated_at'])
    logger.info(
        "ingest.complete edition=%s piece=%s cost_cents=%d lifetime_cents=%d",
        edition.id, edition.piece_id,
        edition.ingestion_cost_cents, edition.ingestion_cost_cents_lifetime,
    )
    return payload


# ===========================================================================
# Helpers
# ===========================================================================

def _load_edition(edition_id: str) -> ScoreEdition:
    return ScoreEdition.objects.select_related('piece', 'piece__composer').get(id=edition_id)


def _identity_from_analysis(analysis: dict) -> ExtractedWorkIdentity:
    """Project the identity subset of a `ScoreAnalysisResult` dict onto the
    `ExtractedWorkIdentity` the resolvers expect — keeps the resolver layer
    untouched by the consolidation."""
    return ExtractedWorkIdentity.model_validate({
        'title': analysis['title'],
        'composer_full_name': analysis['composer_full_name'],
        'arranger': analysis.get('arranger'),
        'composer_birth_year': analysis.get('composer_birth_year'),
        'opus_catalog': analysis.get('opus_catalog'),
        'musical_key': analysis.get('musical_key'),
        'voicing': analysis.get('voicing'),
        'language': analysis.get('language'),
        'text_source': analysis.get('text_source'),
        'epoch': analysis.get('epoch'),
        'confidence': analysis.get('confidence', 0.0),
    })


def _ensure_budget(edition: ScoreEdition) -> None:
    """
    Enforce all three spend guards BEFORE issuing a Claude call:
      * per-run ceiling (resets each (re)ingest)
      * lifetime ceiling (never resets — the true money on this PDF)
      * org-wide daily budget (circuit breaker)
    Re-fetch first so we see costs billed by sibling tasks.
    """
    edition.refresh_from_db(
        fields=['ingestion_cost_cents', 'ingestion_cost_cents_lifetime'],
    )
    AIClient.enforce_ceiling(
        entity_id=str(edition.id),
        spent_cents=edition.ingestion_cost_cents,
        ceiling_cents=settings.INGESTION_COST_CEILING_CENTS,
    )
    AIClient.enforce_ceiling(
        entity_id=f'{edition.id}:lifetime',
        spent_cents=edition.ingestion_cost_cents_lifetime,
        ceiling_cents=settings.INGESTION_LIFETIME_CEILING_CENTS,
    )
    ensure_daily_budget()


def ensure_daily_budget() -> None:
    """Raise `CostCeilingExceeded` if today's org-wide spend hit the budget.
    Exposed so the dispatch façade can fail fast before queueing a run."""
    spent = _daily_spend()
    if spent >= settings.INGESTION_DAILY_BUDGET_CENTS:
        raise CostCeilingExceeded(
            entity_id=f'daily:{_daily_key()}',
            spent_cents=spent,
            ceiling_cents=settings.INGESTION_DAILY_BUDGET_CENTS,
        )


def _daily_key() -> str:
    return f"ingest:daily_spend:{timezone.now():%Y%m%d}"


def _daily_spend() -> int:
    return cache.get(_daily_key(), 0) or 0


def _record_daily_spend(cents: int) -> None:
    """Increment the org-wide daily spend counter (Redis cache, 48h TTL)."""
    if cents <= 0:
        return
    key = _daily_key()
    try:
        cache.incr(key, cents)
    except ValueError:
        # Key absent/expired — seed it. 48h TTL covers the UTC-day rollover.
        cache.set(key, cents, timeout=60 * 60 * 48)


def _bill_edition(edition: ScoreEdition, cents: int) -> None:
    """Atomic cost increment — bills BOTH the per-run and the lifetime counters,
    and the org-wide daily total. Safe under concurrent task execution."""
    if cents <= 0:
        return
    ScoreEdition.objects.filter(pk=edition.pk).update(
        ingestion_cost_cents=F('ingestion_cost_cents') + cents,
        ingestion_cost_cents_lifetime=F('ingestion_cost_cents_lifetime') + cents,
    )
    _record_daily_spend(cents)


def _set_progress(edition_id: str, step: str) -> None:
    """Stamp the fine-grained 'what is the AI doing right now' step. A cheap
    filtered UPDATE; `updated_at` is bumped so the SSE/polling layer sees it."""
    ScoreEdition.objects.filter(pk=edition_id).update(
        ingestion_progress=step,
        updated_at=timezone.now(),
    )


def _composer_name(piece: Piece) -> str:
    if not piece.composer:
        return ''
    return f"{piece.composer.first_name} {piece.composer.last_name}".strip()


def _persist_recordings(*, piece: Piece, source_enum: str, search: Any) -> None:
    """Upsert recordings from a `RecordingSearchResult` — first hit becomes featured."""
    for rec in search.results:
        Recording.objects.update_or_create(
            source=source_enum,
            external_id=rec.external_id,
            defaults={
                'piece': piece,
                'url': rec.url,
                'performer': rec.performer,
                'year': rec.year,
                'duration_seconds': rec.duration_seconds,
                'is_featured': rec.relevance_rank == 0,
            },
        )


def _fail(edition: ScoreEdition, reason: str, payload: dict) -> dict:
    """Mark the edition FAILED with a human-readable reason and abort the chain.
    Lifetime cost is preserved; only the live step is cleared."""
    edition.ingestion_status = IngestionStatus.FAILED
    edition.ingestion_error = reason
    edition.ingestion_progress = ''
    edition.save(update_fields=[
        'ingestion_status', 'ingestion_error', 'ingestion_progress', 'updated_at',
    ])
    logger.error("ingest.failed edition=%s reason=%s", edition.id, reason)
    payload['_aborted'] = True
    return payload


__all__ = [
    'analyze_score',
    'build_ingestion_chain',
    'ensure_daily_budget',
    'finalize_edition',
    'generate_program_note',
    'lookup_spotify',
    'lookup_youtube',
    'persist_analysis',
    'prepare_document',
    'resolve_composer_and_piece',
]
