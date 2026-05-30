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

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsManagerOrReadOnly

from . import services
from .models import (
    Composer,
    IngestionStatus,
    Piece,
    PieceVoiceRequirement,
    ScoreEdition,
    Track,
)
from .serializers import (
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
    start_ingestion,
)
from .signals import piece_material_updated_event

logger = logging.getLogger(__name__)


class ComposerViewSet(viewsets.ModelViewSet):
    """
    Endpoint for managing musical composers and arrangers.
    Read-only for Artists. Write access exclusively for Managers.
    """
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]


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
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]

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
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]

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
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]


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
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
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

        uploaded_file = vd['pdf_file']
        # Optional: pre-attached piece when uploading from inside an
        # existing-piece editor. The pipeline's resolver step then skips
        # MusicBrainz lookup and reuses this FK.
        target_piece = None
        if vd.get('piece_id'):
            try:
                target_piece = Piece.objects.get(id=vd['piece_id'])
            except Piece.DoesNotExist:
                return Response(
                    {'detail': f"Piece {vd['piece_id']} not found."},
                    status=status.HTTP_400_BAD_REQUEST,
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
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
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
