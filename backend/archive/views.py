# archive/views.py
"""
===============================================================================
Archive API ViewSets (Controllers)
===============================================================================
Domain: Archive
Description: 
    REST API boundary. Strictly enforces 'Thin Controller' architecture. 
    All complex business logic, aggregate validations, and state mutations 
    are delegated to the Domain Service Layer (services.py).

Standards: SaaS 2026, RFC 7807 (Global Exception Handling), Aggregate Roots.
===============================================================================
"""

import logging
import uuid

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.exceptions import make_error_response
from core.permissions import IsManager
from core.request_utils import request_user
from roster.queries import artist_live_piece_ids

from . import services
from .models import (
    CONDUCTOR_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    Composer,
    IngestionStatus,
    Movement,
    Piece,
    PieceVoiceRequirement,
    ProgramNote,
    Recording,
    ScoreEdition,
    Track,
    Translation,
)
from .serializers import (
    AnnotationSerializer,
    ComposerSerializer,
    MovementWriteSerializer,
    PieceSerializer,
    PieceVoiceRequirementSerializer,
    RecordingWriteSerializer,
    ScoreEditionDetailSerializer,
    ScoreEditionListSerializer,
    ScoreEditionUploadSerializer,
    TrackSerializer,
    TranslationWriteSerializer,
)
from .services import enrichment, provenance
from .services.ingestion import (
    IngestionPreconditionError,
    cancel_ingestion,
    dispatch_program_note,
    ingestion_is_available,
    start_ingestion,
)
from .signals import piece_material_updated_event
from .tasks import live_preview_cache_key

logger = logging.getLogger(__name__)


def _truthy(value: object) -> bool:
    """Parse a query-param / body flag ('1', 'true', 'yes') into a bool."""
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


class ComposerViewSet(viewsets.ModelViewSet):
    """
    Endpoint for managing musical composers and arrangers.

    Manager-only (read + write): the raw repertoire archive is a back-office
    resource. Choristers receive composer/biography data exclusively through the
    project-scoped materials dashboard, never by browsing the whole library. The
    list endpoint annotates `pieces_count` so the composers page can show
    "Bach: 12 utworów" without a separate query.
    """
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsManager]

    def get_queryset(self):
        return Composer.objects.annotate(
            pieces_count_annotated=Count(
                'pieces', filter=Q(pieces__is_deleted=False),
            ),
        ).order_by('last_name', 'first_name')

    # -----------------------------------------------------------------
    # Custom actions
    # -----------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='merge_into/(?P<target_id>[^/.]+)')
    def merge_into(self, request, pk=None, target_id=None):
        """
        Move every Piece + ProvenanceRecord from this composer (source) onto
        `target_id`, then soft-delete the source. Used to consolidate
        duplicates the AI pipeline failed to dedupe (e.g. "J.S. Bach" and
        "Johann Sebastian Bach").

        Refuses to merge a composer into itself or into a deleted target.
        """
        source = self.get_object()
        if str(source.id) == str(target_id):
            return Response(
                {'detail': 'Cannot merge a composer into itself.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target = Composer.objects.get(id=target_id, is_deleted=False)
        except Composer.DoesNotExist:
            return Response(
                {'detail': f'Target composer {target_id} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            reassigned = Piece.objects.filter(composer=source).update(
                composer=target,
            )
            source.delete()

        logger.info(
            "composer.merged source=%s target=%s pieces_moved=%d",
            source.id, target.id, reassigned,
        )
        target.refresh_from_db()
        # Re-annotate so pieces_count reflects the merged total.
        annotated = (
            Composer.objects
            .filter(id=target.id)
            .annotate(
                pieces_count_annotated=Count(
                    'pieces', filter=Q(pieces__is_deleted=False),
                ),
            )
            .first()
        )
        return Response(
            ComposerSerializer(annotated or target).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='refresh_mb')
    def refresh_mb(self, request, pk=None):
        """
        Re-pull MusicBrainz + Wikidata data for this composer.

        Modes (pass `?force=true` or body `{"force": true}`):
          * default — fill ONLY blank fields; existing data is untouched.
          * force   — also overwrite canonical fields with fresh external
                      values, EXCEPT any field a conductor edited by hand.

        Returns a diagnostic payload so a no-op is explained rather than
        looking like a silent failure: which fields were filled / overwritten /
        skipped, the resolved mbid + Wikidata QID, and which sources responded.
        """
        composer = self.get_object()
        force = _truthy(request.query_params.get('force')) or _truthy(
            request.data.get('force') if hasattr(request.data, 'get') else None
        )

        report = enrichment.refresh_composer(composer, force=force)
        if report.status == enrichment.STATUS_NO_NAME:
            return Response(
                {'detail': 'Composer has no name — cannot resolve.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Re-annotate so pieces_count is included in the response.
        annotated = self.get_queryset().filter(id=composer.id).first()
        return Response(
            {
                'composer': ComposerSerializer(annotated or composer).data,
                # `fields_filled` keeps its original meaning (every field that
                # changed) for backward compatibility with existing clients.
                'fields_filled': report.changed,
                'fields_overwritten': report.fields_overwritten,
                'fields_skipped_existing': report.fields_skipped_existing,
                'status': report.status,
                'mbid': report.mbid,
                'wikidata_qid': report.wikidata_qid,
                'sources': {
                    'musicbrainz': report.mbz_responded,
                    'wikidata': report.wiki_responded,
                },
            },
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        """Refuse to delete composers that still own pieces — safer than
        cascading the FK or silently orphaning sub-entities."""
        composer = self.get_object()
        pieces_count = composer.pieces.filter(is_deleted=False).count()
        if pieces_count > 0:
            return Response(
                {
                    'detail': (
                        f'Cannot delete composer with {pieces_count} associated pieces. '
                        f'Reassign or merge first.'
                    ),
                    'pieces_count': pieces_count,
                },
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class PieceViewSet(viewsets.ModelViewSet):
    """
    Core aggregate root endpoint for managing the musical repertoire.
    Strictly delegates all state mutations to ArchiveManagementService.
    """
    queryset = (
        Piece.objects
        .select_related('composer')
        .prefetch_related(
            'tracks',
            'voice_requirements',
            'movements',
            'translations',
            'recordings',
            'program_notes',
            'editions',
        )
        .all()
    )
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsManager]

    def get_serializer_context(self) -> dict:
        # Concrete dict: DRF stubs surface the base context as a read-only
        # Mapping, which blocks the keyed assignment + dict return below.
        ctx = dict(super().get_serializer_context())
        # Per-field provenance is one extra query; only the single-piece review
        # surfaces (detail / write responses) need it, never the list.
        ctx['include_provenance'] = self.action in (
            'retrieve', 'create', 'update', 'partial_update',
        )
        return ctx

    def create(self, request, *args, **kwargs) -> Response:
        serializer = PieceSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        dto = serializer.to_dto()
        piece = services.ArchiveManagementService.create_piece(dto=dto)
        return Response(self.get_serializer(piece).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs) -> Response:
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = PieceSerializer(
            instance, data=request.data, partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        dto = serializer.to_dto(instance=instance)
        piece = services.ArchiveManagementService.update_piece(
            piece=instance, dto=dto, actor_email=_actor_email(request),
        )
        return Response(self.get_serializer(piece).data)

    @action(detail=True, methods=['post'], url_path='generate_program_note')
    def generate_program_note(self, request, pk=None):
        """
        Generate (or, with `?force=true`, regenerate) the AI programme note for
        this piece on demand. Program notes are no longer produced eagerly at
        ingest — the conductor asks for one from the review cockpit when wanted.
        Returns 202 with the Celery task id; the note appears on a later refetch.
        """
        piece = self.get_object()
        force = _truthy(request.query_params.get('force')) or _truthy(
            request.data.get('force') if hasattr(request.data, 'get') else None
        )
        language = request.query_params.get('language') or (
            request.data.get('language') if hasattr(request.data, 'get') else None
        )
        try:
            task_id = dispatch_program_note(piece, force=force, language=language or None)
        except IngestionPreconditionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {'celery_task_id': task_id, 'status': 'dispatched'},
            status=status.HTTP_202_ACCEPTED,
        )


class TrackViewSet(viewsets.ModelViewSet):
    """
    Endpoint for managing individual rehearsal audio tracks.
    """
    queryset = Track.objects.select_related('piece').all()
    serializer_class = TrackSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'voice_part']
    permission_classes = [permissions.IsAuthenticated, IsManager]

    def create(self, request, *args, **kwargs) -> Response:
        """
        Delegates Track creation (and potential future audio-processing side-effects) 
        to the Domain Service Layer.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        track = services.ArchiveManagementService.create_track(serializer.validated_data)
        
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(track).data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_destroy(self, instance) -> None:
        """Ensures safe deletion via service layer."""
        services.ArchiveManagementService.delete_track(instance)


class PieceVoiceRequirementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint for viewing vocal arrangement requirements (divisi) per piece.
    
    ARCHITECTURAL RULE (Aggregate Roots):
    Write operations are explicitly disabled here (`ReadOnlyModelViewSet`). 
    Voice requirements are strictly sub-entities of a 'Piece'. They must never 
    be mutated independently of their parent to prevent orphaned records and 
    domain state corruption. Mutate them via PieceViewSet (`PieceWriteDTO`).
    """
    queryset = PieceVoiceRequirement.objects.all()
    serializer_class = PieceVoiceRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsManager]


# ===========================================================================
# AI artifacts — inline correction endpoints for the Review cockpit
# ===========================================================================
# Movements, translations and recordings are the AI's most error-prone outputs
# (a hallucinated movement, a wrong translation line, an irrelevant recording).
# They used to be read-only inside the Piece payload with nowhere to fix them.
# These manager-only endpoints let the conductor correct or delete them during
# review; editing a movement/translation by hand stamps MANUAL provenance so the
# field's chip flips from "AI-suggested" to "verified".
#
#   GET/POST           /api/archive/movements/        (?piece=<uuid>)
#   PATCH/DELETE       /api/archive/movements/{id}/
#   …likewise translations, recordings.
# ===========================================================================

def _actor_email(request) -> str:
    user = request_user(request)
    return getattr(user, 'email', '') or ''


class MovementViewSet(viewsets.ModelViewSet):
    """Inline CRUD for movements (manager-only). Editing stamps MANUAL provenance."""
    queryset = Movement.objects.select_related('piece').order_by('piece', 'order_index')
    serializer_class = MovementWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece']

    def perform_update(self, serializer) -> None:
        movement = serializer.save()
        provenance.record_manual(
            target=movement, field_name='title',
            actor_email=_actor_email(self.request),
        )

    def perform_destroy(self, instance) -> None:
        instance.delete()  # EnterpriseBaseModel soft-delete


class TranslationViewSet(viewsets.ModelViewSet):
    """Inline CRUD for translations (manager-only). Editing stamps MANUAL provenance."""
    queryset = Translation.objects.select_related('piece').order_by('target_language')
    serializer_class = TranslationWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'target_language']

    def perform_update(self, serializer) -> None:
        translation = serializer.save()
        provenance.record_manual(
            target=translation, field_name='text',
            actor_email=_actor_email(self.request),
        )

    def perform_destroy(self, instance) -> None:
        instance.delete()  # EnterpriseBaseModel soft-delete


class RecordingViewSet(viewsets.ModelViewSet):
    """Inline CRUD for reference recordings (manager-only): toggle the featured
    pick, drop an irrelevant hit, or add a hand-picked one."""
    queryset = Recording.objects.select_related('piece').order_by('-is_featured')
    serializer_class = RecordingWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'source']

    def perform_destroy(self, instance) -> None:
        instance.delete()  # EnterpriseBaseModel soft-delete


# ===========================================================================
# Score Package Compiler — ScoreEdition endpoint
# ===========================================================================
# REST surface for the conductor's review workflow (Phase 3 UI):
#
#   POST   /api/archive/editions/                multipart upload + dispatch
#   GET    /api/archive/editions/                list (lean payload)
#   GET    /api/archive/editions/{id}/           detail (full nested payload)
#   PATCH  /api/archive/editions/{id}/           edit edition-level fields
#   DELETE /api/archive/editions/{id}/           soft-delete
#   POST   /api/archive/editions/{id}/approve/   mark AWAITING → READY
#   POST   /api/archive/editions/{id}/reingest/  re-run the pipeline
#
# Per-field edits to piece / composer / movements / etc. go through their
# existing dedicated endpoints (/api/pieces/, /api/composers/) — this
# ViewSet stays focused on the edition + workflow control actions.
# ===========================================================================

class ScoreEditionViewSet(viewsets.ModelViewSet):
    """
    Edition lifecycle endpoint. Thin controller — delegates ingestion
    dispatch to `services.ingestion.start_ingestion` and never calls
    `tasks.s()` chains directly.
    """
    permission_classes = [permissions.IsAuthenticated, IsManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['ingestion_status', 'piece']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return (
            ScoreEdition.objects
            .select_related('piece', 'piece__composer', 'uploaded_by')
            .prefetch_related(
                'piece__movements',
                'piece__translations',
                'piece__recordings',
                'piece__program_notes',
                'piece__voice_requirements',
                'annotations',
            )
            .order_by('-created_at')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return ScoreEditionUploadSerializer
        if self.action == 'list':
            return ScoreEditionListSerializer
        return ScoreEditionDetailSerializer

    def create(self, request, *args, **kwargs):
        """
        Upload a PDF and dispatch ingestion. The Workflow A pipeline:
          1. Extracts text from the first pages of the PDF.
          2. Identifies title/composer via Claude.
          3. Resolves / creates the canonical Piece and Composer.
          4. Generates movements, lyrics, IPA, program note.
          5. Looks up Spotify / YouTube recordings.
          6. Transitions status to AWAITING for conductor review.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        # Fail fast on a missing pipeline prerequisite BEFORE persisting a row,
        # so an unconfigured deploy returns a clear, stable error instead of a
        # bare 400 and a trail of orphaned, un-processable editions.
        if not ingestion_is_available():
            logger.error("ingestion_unavailable: ANTHROPIC_API_KEY is not configured")
            return make_error_response(
                request,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                error_code="ingestion_unavailable",
                detail="Automatic score processing is temporarily unavailable.",
            )

        uploaded_file = vd['pdf_file']
        # Optional: pre-attached piece when uploading from inside an
        # existing-piece editor. The pipeline's resolver step then skips
        # MusicBrainz lookup and reuses this FK.
        target_piece = None
        if vd.get('piece_id'):
            try:
                target_piece = Piece.objects.get(id=vd['piece_id'])
            except Piece.DoesNotExist:
                return make_error_response(
                    request,
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error_code="piece_not_found",
                    detail=f"Piece {vd['piece_id']} not found.",
                )
        edition = ScoreEdition.objects.create(
            piece=target_piece,
            pdf_file=uploaded_file,
            original_filename=vd.get('original_filename') or uploaded_file.name,
            publisher=vd.get('publisher', ''),
            edition_year=vd.get('edition_year'),
            editor_name=vd.get('editor_name', ''),
            is_default=vd.get('is_default', False),
            sha256='',
            page_count=0,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )

        try:
            ticket = start_ingestion(edition)
        except IngestionPreconditionError as exc:
            logger.warning("ingestion_dispatch_failed edition=%s err=%s", edition.id, exc)
            # Never leave an un-processable orphan behind.
            edition.delete()
            return make_error_response(
                request,
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="ingestion_precondition",
                detail=str(exc),
            )

        edition.refresh_from_db()
        body = ScoreEditionDetailSerializer(edition, context={'request': request}).data
        body['celery_task_id'] = ticket.celery_task_id
        return Response(body, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        # Block full PUT on file-bearing rows; PATCH only for metadata.
        return Response(
            {'detail': 'Full replacement not allowed. Use PATCH or upload a new edition.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        """Metadata-only PATCH (never the file). The detail serializer's writable
        set — publisher / edition_year / editor_name / is_default and the licence
        fields (license_type / copies_owned) — is the whole editable surface; the
        PDF, sha256 and ingestion state stay read-only."""
        instance = self.get_object()
        serializer = ScoreEditionDetailSerializer(
            instance, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def perform_destroy(self, instance: ScoreEdition) -> None:
        # Inherit EnterpriseBaseModel soft-delete (sets is_deleted=True).
        instance.delete()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Conductor approves AI extractions. Flips AWAITING → READY.
        Refuses to approve a FAILED or in-progress edition.
        """
        edition = self.get_object()
        if edition.ingestion_status != IngestionStatus.AWAITING:
            return Response(
                {
                    'detail': f'Cannot approve edition in status '
                              f'{edition.get_ingestion_status_display()!r}. '
                              f'Only AWAITING editions can be approved.',
                },
                status=status.HTTP_409_CONFLICT,
            )
        edition.ingestion_status = IngestionStatus.READY
        edition.save(update_fields=['ingestion_status', 'updated_at'])
        # Approval is the "identity is now confirmed" moment — so it is the
        # right trigger to generate the audience programme note (which is
        # deliberately kept OUT of the ingestion chain, to avoid writing prose
        # from un-reviewed AI identity). Only when none exists yet, so re-approve
        # never regenerates over a conductor's note. Best-effort: a note-dispatch
        # hiccup (missing key, budget) must never block the approval itself — the
        # cockpit's manual "Generuj notkę" button remains as the fallback.
        if edition.piece_id and not ProgramNote.objects.filter(
            piece_id=edition.piece_id, project__isnull=True,
        ).exists():
            try:
                dispatch_program_note(edition.piece)
            except IngestionPreconditionError as exc:
                logger.info(
                    "archive.approve note_skipped edition=%s reason=%s",
                    edition.id, exc,
                )
        # Notify project participants — approval is when materials become safe
        # to circulate (vs AWAITING which is mid-review and may still hallucinate).
        if edition.piece_id:
            piece_material_updated_event.send(
                sender=self.__class__, piece=edition.piece, kind="score",
            )
        return Response(
            ScoreEditionDetailSerializer(edition, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def reingest(self, request, pk=None):
        """
        Re-run the ingestion pipeline. Use after editing prompt text or to
        recover from a transient external-API failure. Resets cost counter.

        Pass `?force=true` to dispatch even if the edition status looks
        mid-pipeline — useful when a previous chain died silently (Celery
        crash / dead worker) and the row is stuck in EXTR / ENRI / GENR.
        """
        edition = self.get_object()
        force = str(request.query_params.get('force', '')).lower() in ('1', 'true', 'yes')
        try:
            ticket = start_ingestion(edition, force=force)
        except IngestionPreconditionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        edition.refresh_from_db()
        body = ScoreEditionDetailSerializer(edition, context={'request': request}).data
        body['celery_task_id'] = ticket.celery_task_id
        return Response(body, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cooperatively cancel an in-flight ingestion (wrong PDF, changed mind).
        Marks the edition FAILED immediately and stops the chain at its next
        task boundary so no further AI spend is incurred. 409 if already
        terminal (nothing to cancel).
        """
        edition = self.get_object()
        try:
            cancel_ingestion(edition)
        except IngestionPreconditionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(
            ScoreEditionDetailSerializer(edition, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Every in-flight (non-terminal) ingestion across the archive.

        Powers the persistent "AI w toku" panel: a freshly uploaded edition is
        not attached to a Piece until the resolver step, so it never shows in
        the pieces list while it processes — and a page refresh wipes the
        client-side upload row. This endpoint is the durable source of truth, so
        the panel can repopulate after a reload and show exactly what the AI is
        doing right now.
        """
        qs = self.get_queryset().filter(
            ingestion_status__in=[
                IngestionStatus.PENDING,
                IngestionStatus.EXTRACTING,
                IngestionStatus.ENRICHING,
                IngestionStatus.GENERATING,
            ],
        )
        serializer = ScoreEditionListSerializer(
            qs, many=True, context={'request': request},
        )
        rows = serializer.data
        # Attach the live partial-analysis preview (published by the streaming
        # callback while Claude reads the score) so the panel shows the record
        # materialising — title, composer, current section — not just a label.
        keys = {row['id']: live_preview_cache_key(row['id']) for row in rows}
        found = cache.get_many(list(keys.values())) if keys else {}
        for row in rows:
            preview = found.get(keys[row['id']])
            row['live_preview'] = preview if isinstance(preview, dict) else None
        return Response(rows)


# ===========================================================================
# Score annotations — conductor markup overlay + personal pencil marks
# ===========================================================================
# Markings are stored as data (never mutating the source PDF) on a named layer:
#
#   layer_name = 'shared'    → conductor→choir: pushed to every chorister cast
#                              in a LIVE project featuring the piece.
#   layer_name = 'conductor' → the maestro's private cues, never sent to singers.
#   layer_name = 'personal'  → a single user's own pencil marks, scoped by
#                              created_by — invisible to everyone else,
#                              managers included.
#
# Access deliberately mirrors ScoreEditionDownloadView so a score and its
# markings appear and expire together:
#   * managers          → full CRUD on 'shared' + 'conductor' (any edition),
#                         plus their OWN 'personal' marks. Never other users'.
#   * choristers/crew   → read 'shared' + full CRUD on their OWN 'personal'
#                         marks, only on editions whose piece they still have
#                         live access to.
# ===========================================================================


class AnnotationViewSet(viewsets.ModelViewSet):
    """
    CRUD for score annotations. Thin controller: read scope is decided in
    `get_queryset` (role-aware; also bounds object lookup for writes), write
    scope in the `perform_*` hooks (non-managers may only touch their own
    'personal' marks), and `created_by` is stamped from the request — never
    trusted from the payload.
    """
    serializer_class = AnnotationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['edition', 'page_number', 'layer_name']

    def _is_manager(self) -> bool:
        user = request_user(self.request)
        profile = getattr(user, 'profile', None)
        return user.is_staff or (profile is not None and profile.is_manager)

    def get_queryset(self):
        user = request_user(self.request)
        base = (
            Annotation.objects
            .select_related('edition')
            .filter(is_deleted=False)
            .order_by('created_at')
        )
        own_personal = Q(layer_name=PERSONAL_ANNOTATION_LAYER, created_by=user)
        if self._is_manager():
            # Everything except OTHER users' personal pencil marks — those stay
            # private even from the maestro.
            return base.filter(~Q(layer_name=PERSONAL_ANNOTATION_LAYER) | own_personal)
        # Chorister / crew: the shared layer plus their own personal marks,
        # only on still-accessible pieces.
        return base.filter(
            Q(layer_name=SHARED_ANNOTATION_LAYER) | own_personal,
            edition__piece_id__in=artist_live_piece_ids(user),
        )

    def _assert_can_write(
        self,
        *,
        layer_name: str,
        edition: ScoreEdition,
        instance: Annotation | None = None,
    ) -> None:
        """
        Non-managers may only touch their OWN marks on the 'personal' layer, and
        only on editions they still have live access to. Managers pass freely —
        other users' personal marks are already unreachable via get_queryset.
        """
        if self._is_manager():
            return
        user = request_user(self.request)
        if layer_name != PERSONAL_ANNOTATION_LAYER:
            raise PermissionDenied('Only personal-layer annotations may be written.')
        if instance is not None and instance.created_by_id != user.id:
            raise PermissionDenied('You may only modify your own annotations.')
        if edition.piece_id not in set(artist_live_piece_ids(user)):
            raise PermissionDenied('No live access to this edition.')

    def perform_create(self, serializer) -> None:
        edition = serializer.validated_data['edition']
        layer = serializer.validated_data.get('layer_name') or CONDUCTOR_ANNOTATION_LAYER
        self._assert_can_write(layer_name=layer, edition=edition)
        serializer.save(created_by=request_user(self.request))

    def perform_update(self, serializer) -> None:
        instance = serializer.instance
        # Validate against the TARGET layer so a patch can't smuggle a personal
        # mark onto 'shared' (or a chorister edit onto a shared mark).
        layer = serializer.validated_data.get('layer_name', instance.layer_name)
        edition = serializer.validated_data.get('edition', instance.edition)
        self._assert_can_write(layer_name=layer, edition=edition, instance=instance)
        serializer.save()

    def perform_destroy(self, instance: Annotation) -> None:
        self._assert_can_write(
            layer_name=instance.layer_name,
            edition=instance.edition,
            instance=instance,
        )
        # Inherit EnterpriseBaseModel soft-delete (sets is_deleted=True).
        instance.delete()

    @action(detail=False, methods=['post'], url_path='clear')
    def clear(self, request):
        """
        Bulk soft-delete on one edition. Managers wipe 'shared' + 'conductor'
        (never anyone's personal layer; pass `layer_name` to narrow — 'personal'
        narrows to their own marks). Non-managers always wipe only their OWN
        personal marks. Body: {edition, layer_name?}.
        """
        edition_id = request.data.get('edition')
        if not edition_id:
            return Response(
                {'detail': 'edition is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            uuid.UUID(str(edition_id))
        except (ValueError, TypeError):
            return Response(
                {'detail': 'edition must be a valid id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Never blind-delete by raw id: confirm the edition exists so a stray or
        # forged id can't silently no-op (and so the response is an honest 404).
        if not ScoreEdition.objects.filter(pk=edition_id).exists():
            return Response(
                {'detail': 'edition not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = request_user(request)
        qs = Annotation.objects.filter(edition_id=edition_id, is_deleted=False)
        layer = request.data.get('layer_name')
        if self._is_manager():
            if layer:
                qs = qs.filter(layer_name=layer)
                if layer == PERSONAL_ANNOTATION_LAYER:
                    qs = qs.filter(created_by=user)
            else:
                qs = qs.exclude(layer_name=PERSONAL_ANNOTATION_LAYER)
        else:
            qs = qs.filter(layer_name=PERSONAL_ANNOTATION_LAYER, created_by=user)
        deleted = qs.count()
        qs.delete()  # SoftDeleteQuerySet → bulk is_deleted=True
        return Response({'deleted': deleted}, status=status.HTTP_200_OK)
