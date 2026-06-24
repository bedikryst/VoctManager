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

from django.db import transaction
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.exceptions import make_error_response
from core.permissions import IsManager
from core.request_utils import request_user
from roster.queries import artist_live_piece_ids

from . import services
from .infrastructure.musicbrainz_client import MusicBrainzClient
from .infrastructure.wikidata_client import WikidataClient
from .models import (
    Annotation,
    Composer,
    IngestionStatus,
    Piece,
    PieceVoiceRequirement,
    ScoreEdition,
    Track,
)
from .serializers import (
    AnnotationSerializer,
    ComposerSerializer,
    PieceSerializer,
    PieceVoiceRequirementSerializer,
    ScoreEditionDetailSerializer,
    ScoreEditionListSerializer,
    ScoreEditionUploadSerializer,
    TrackSerializer,
)
from .services.ingestion import (
    IngestionPreconditionError,
    ingestion_is_available,
    start_ingestion,
)
from .signals import piece_material_updated_event

logger = logging.getLogger(__name__)


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
        Re-run MusicBrainz + Wikidata enrichment for this composer. Populates
        ONLY blank fields — never overwrites a conductor's manual edit.

        Useful when the AI pipeline ran before Wikidata coverage caught up,
        or when a composer was added manually and you want to attach the
        canonical biographical data.
        """
        composer = self.get_object()
        full_name = f"{composer.first_name} {composer.last_name}".strip()
        if not full_name:
            return Response(
                {'detail': 'Composer has no name — cannot resolve.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mbz = (
            MusicBrainzClient.search_composer(name=full_name)
            if not composer.mbid
            else None
        )
        wiki = None
        if composer.mbid:
            wiki = WikidataClient.enrich_composer_by_mbid(composer.mbid)
        elif mbz and mbz.mbid:
            wiki = WikidataClient.enrich_composer_by_mbid(mbz.mbid)
        else:
            wiki = WikidataClient.enrich_composer_by_name(full_name)

        update_fields: list[str] = []

        if not composer.mbid and mbz and mbz.mbid:
            composer.mbid = mbz.mbid
            update_fields.append('mbid')

        if wiki:
            if not composer.wikidata_qid and wiki.wikidata_qid:
                composer.wikidata_qid = wiki.wikidata_qid
                update_fields.append('wikidata_qid')
            for attr in ('bio', 'portrait_url', 'portrait_license', 'nationality', 'period'):
                value = getattr(wiki, attr, '')
                if value and not getattr(composer, attr):
                    setattr(composer, attr, value)
                    update_fields.append(attr)
            if wiki.birth_year and not composer.birth_year:
                composer.birth_year = str(wiki.birth_year)
                update_fields.append('birth_year')
            if wiki.death_year and not composer.death_year:
                composer.death_year = str(wiki.death_year)
                update_fields.append('death_year')

        if update_fields:
            composer.save(update_fields=[*update_fields, 'updated_at'])

        logger.info(
            "composer.refreshed id=%s fields_filled=%s",
            composer.id, update_fields,
        )

        # Re-annotate so pieces_count is included in the response.
        annotated = (
            self.get_queryset().filter(id=composer.id).first()
        )
        return Response(
            {
                'composer': ComposerSerializer(annotated or composer).data,
                'fields_filled': update_fields,
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
        piece = services.ArchiveManagementService.update_piece(piece=instance, dto=dto)
        return Response(self.get_serializer(piece).data)


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
        # Notify project participants — approval is when materials become safe
        # to circulate (vs AWAITING which is mid-review and may still hallucinate).
        if edition.piece_id:
            piece_material_updated_event.send(
                sender=self.__class__, piece=edition.piece,
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
        return Response(serializer.data)


# ===========================================================================
# Score annotations — conductor markup overlay
# ===========================================================================
# The conductor draws breath marks, cuts, dynamics and pins rehearsal comments
# onto a ScoreEdition PDF. Markings are stored as data (never mutating the source
# PDF) on a named layer:
#
#   layer_name = 'shared'    → pushed to every chorister cast in a LIVE project
#                              featuring the piece (the headline feature).
#   layer_name = 'conductor' → the maestro's private cues, never sent to singers.
#
# Access deliberately mirrors ScoreEditionDownloadView so a score and its shared
# markings appear and expire together:
#   * managers          → full CRUD, every layer, any edition.
#   * choristers/crew   → READ-ONLY, 'shared' layer only, and only on editions
#                         whose piece they still have live access to.
# ===========================================================================

SHARED_ANNOTATION_LAYER = 'shared'


class AnnotationViewSet(viewsets.ModelViewSet):
    """
    CRUD for score annotations. Thin controller: read scope is decided in
    `get_queryset` (role-aware), write access in `get_permissions` (managers
    only), and `created_by` is stamped from the request — never trusted from
    the payload.
    """
    serializer_class = AnnotationSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['edition', 'page_number', 'layer_name']

    def get_permissions(self):
        # Anyone authenticated may read (scope is narrowed in get_queryset);
        # only managers may create / update / delete markings.
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsManager()]

    def get_queryset(self):
        user = request_user(self.request)
        base = (
            Annotation.objects
            .select_related('edition')
            .filter(is_deleted=False)
            .order_by('created_at')
        )
        profile = getattr(user, 'profile', None)
        if user.is_staff or (profile is not None and profile.is_manager):
            return base
        # Chorister / crew: only the shared layer, only on still-accessible pieces.
        return base.filter(
            layer_name=SHARED_ANNOTATION_LAYER,
            edition__piece_id__in=artist_live_piece_ids(user),
        )

    def perform_create(self, serializer) -> None:
        serializer.save(created_by=request_user(self.request))

    def perform_destroy(self, instance: Annotation) -> None:
        # Inherit EnterpriseBaseModel soft-delete (sets is_deleted=True).
        instance.delete()

    @action(detail=False, methods=['post'], url_path='clear')
    def clear(self, request):
        """
        Manager-only bulk soft-delete of every annotation on an edition (all
        layers by default; pass `layer_name` to scope). POST so it's gated by the
        manager check in get_permissions. Body: {edition, layer_name?}.
        """
        edition_id = request.data.get('edition')
        if not edition_id:
            return Response(
                {'detail': 'edition is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = Annotation.objects.filter(edition_id=edition_id, is_deleted=False)
        layer = request.data.get('layer_name')
        if layer:
            qs = qs.filter(layer_name=layer)
        deleted = qs.count()
        qs.delete()  # SoftDeleteQuerySet → bulk is_deleted=True
        return Response({'deleted': deleted}, status=status.HTTP_200_OK)
