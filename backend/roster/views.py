# roster/views.py
# ==========================================
# Roster API ViewSets (Thin Controllers)
# Standard: Enterprise SaaS 2026
# ==========================================
"""
REST API Controllers for the Roster application.
Strictly handles HTTP protocol parsing, RBAC-based QuerySet routing, and Response formatting. 
Delegates ALL state-mutating business logic to the Service Layer.
"""
import io
import logging
import os
from decimal import Decimal, InvalidOperation

from celery.result import AsyncResult
from django.core.cache import cache
from django.db.models import Count, Prefetch, Q
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from django_filters.rest_framework import DjangoFilterBackend
from pydantic import ValidationError
from rest_framework import permissions, status, views, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from archive.models import PieceVoiceRequirement, Recording, ScoreEdition, Track
from archive.score_protection import (
    build_watermark_footer,
    copy_holder_name,
    record_binder_access,
    record_edition_access,
)
from core.constants import VoiceLine
from core.exceptions import format_pydantic_validation_errors, make_error_response
from core.permissions import IsManager, IsManagerOrReadOnly
from core.request_utils import request_user

from .dashboard_serializers import (
    ConductedProjectMaterialsSerializer,
    ParticipationMaterialsSerializer,
)
from .dtos import (
    ArtistCreateDTO,
    AttendanceRecordDTO,
    ParticipationStatusUpdateDTO,
    PieceReadinessUpdateDTO,
    ProjectBulkFeeDTO,
    ProjectCreateDTO,
    ProjectUpdateDTO,
    RehearsalCreateDTO,
    RehearsalUpdateDTO,
)
from .exceptions import ArtistProvisioningException, AttendanceValidationException, CastingValidationException
from .infrastructure.document_generator import (
    Audience,
    DocumentGenerator,
    DocumentRenderDependencyError,
)
from .infrastructure.score_watermark import stamp_pdf

# Models & Exceptions
from .models import (
    Artist,
    Attendance,
    Collaborator,
    CrewAssignment,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    ScorePackage,
    VoiceType,
)
from .queries import (
    artist_has_live_access_to_piece,
    get_artist_dossier,
    get_artist_materials_queryset,
    get_artist_schedule,
    get_conductor_materials_projects,
)
from .queries.materials_queries import CLOSED_PROJECT_STATUSES
from .score_package_service import ScorePackageItemError, ScorePackageService

# Serializers
from .serializers import (
    ArtistBasicSerializer,
    ArtistDetailedSerializer,
    ArtistMeSerializer,
    AttendanceSerializer,
    CollaboratorBasicSerializer,
    CollaboratorSerializer,
    CrewAssignmentBasicSerializer,
    CrewAssignmentSerializer,
    ParticipationBasicSerializer,
    ParticipationDetailedSerializer,
    ProgramItemSerializer,
    ProjectPieceCastingSerializer,
    ProjectSerializer,
    RehearsalSerializer,
)
from .services import (
    ArtistHRService,
    CastingAndCrewService,
    ParticipationService,
    PieceReadinessService,
    ProjectManagementService,
    RehearsalOperationsService,
)
from .tasks import generate_project_zip_task


def _is_manager(user) -> bool:
    """Helper for evaluating manager privileges safely."""
    return hasattr(user, 'profile') and user.profile.is_manager


# Chorister material-access rule now lives in roster.queries.materials_queries so
# the archive AnnotationViewSet can share the exact same gate (scores + their
# shared markings expire together when every project featuring the piece closes).
logger = logging.getLogger(__name__)

# Thin module-local aliases preserve the existing private call sites below.
_CLOSED_PROJECT_STATUSES = CLOSED_PROJECT_STATUSES
_artist_has_live_access_to_piece = artist_has_live_access_to_piece


class PdfRenderUnavailable(APIException):
    """503 raised when WeasyPrint's native rendering libraries are missing on the host."""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "PDF rendering is temporarily unavailable on the server."
    default_code = "pdf_render_unavailable"


# On-demand watermarking is not a hot path (scores are read, not spammed), but a
# per-recipient binder can be many MB — cache the stamped bytes briefly, keyed by
# (scope, user, copy number), and skip the cache for anything oversized.
_WATERMARK_CACHE_TTL_SECONDS = 60 * 30
_WATERMARK_CACHE_MAX_BYTES = 30 * 1024 * 1024


def _watermarked_pdf(raw: bytes, *, cache_key: str, footer_text: str) -> bytes:
    """Return ``raw`` stamped with ``footer_text``, memoised per recipient/build.
    Propagates DocumentRenderDependencyError so the caller can refuse to serve an
    unstamped protected score when the renderer is unavailable."""
    cached = cache.get(cache_key)
    if isinstance(cached, bytes):
        return cached
    stamped = stamp_pdf(raw, footer_text)
    if len(stamped) <= _WATERMARK_CACHE_MAX_BYTES:
        cache.set(cache_key, stamped, _WATERMARK_CACHE_TTL_SECONDS)
    return stamped


def _pdf_bytes_response(data: bytes, *, filename: str) -> FileResponse:
    """Wrap in-memory PDF bytes (e.g. a freshly watermarked score) as an inline
    FileResponse, matching the header shape of the raw-file streaming path."""
    response = FileResponse(io.BytesIO(data), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    response['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return response


def _settlement_contract_response(record: Participation | CrewAssignment) -> FileResponse:
    """Renders the legal contract PDF for one cast/crew record and wraps it for download."""
    person: Artist | Collaborator
    try:
        if isinstance(record, Participation):
            pdf_bytes = DocumentGenerator.generate_participation_contract_pdf(record)
            person = record.artist
        else:
            pdf_bytes = DocumentGenerator.generate_crew_contract_pdf(record)
            person = record.collaborator
    except DocumentRenderDependencyError as exc:
        raise PdfRenderUnavailable(str(exc)) from exc

    filename = f"Umowa_{person.last_name}_{person.first_name}.pdf".replace(' ', '_')
    buffer = io.BytesIO(pdf_bytes)
    buffer.seek(0)
    response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
    response['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return response


def _apply_payment(record: Participation | CrewAssignment, is_paid: bool) -> None:
    """Toggles a record's settlement state, keeping `paid_at` consistent with `is_paid`."""
    record.is_paid = is_paid
    record.paid_at = timezone.now() if is_paid else None
    record.save()


_MAX_FEE = Decimal("999999.99")


def _parse_fee(raw: object) -> Decimal | None:
    """Coerces an incoming fee value to a bounded 2-dp Decimal (or None to clear it)."""
    if raw is None or raw == '':
        return None
    try:
        value = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("invalid_fee") from exc
    if value < 0 or value > _MAX_FEE:
        raise ValueError("fee_out_of_range")
    return value


def _fee_action(viewset, request) -> Response:
    """
    Shared fee-update handler. Writes the fee directly instead of routing through
    the ModelSerializer: DRF mis-handles `Participation`'s conditional
    UniqueConstraint on partial updates (it reads the condition field
    `is_deleted` straight from the request payload and KeyErrors), which made the
    generic `PATCH /participations/{id}/` fee edit 500. This bypass keeps fee
    editing robust and symmetric across cast and crew.
    """
    record = viewset.get_object()
    try:
        fee_value = _parse_fee(request.data.get('fee'))
    except ValueError:
        return Response(
            {"detail": "Enter a valid, non-negative fee (max 999999.99)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    record.fee = fee_value
    record.save()
    return Response(viewset.get_serializer(record).data, status=status.HTTP_200_OK)


class ResendActivationThrottle(UserRateThrottle):
    """Per-manager cap on re-sending activation invites, under the
    ``resend_activation`` rate. Subclasses ``UserRateThrottle`` so the bucket is
    keyed on the acting manager's id, independent of the coarse project-wide
    ``user`` scope."""

    scope = 'resend_activation'


class ArtistViewSet(viewsets.ModelViewSet):
    """
    Artist Lifecycle & HR Management.
    Read access is public to authenticated users (for roster visibility).
    Write access is restricted to Managers.
    """
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]

    def get_queryset(self):
        # Data Partitioning: Managers see everyone, Artists see restricted subsets or everyone (depending on biz rules). 
        # Here we allow seeing all active artists, but serializers will strip sensitive data.
        # select_related user__profile so the avatar thumbnail does not trigger
        # an extra query per artist card.
        qs = Artist.objects.select_related('user', 'user__profile').all()
        return qs if _is_manager(self.request.user) else qs.filter(user=request_user(self.request))
    
    def get_serializer_class(self):
        if _is_manager(self.request.user):
            return ArtistDetailedSerializer
        if self.action == 'me':
            return ArtistMeSerializer
        return ArtistBasicSerializer
    
    def create(self, request, *args, **kwargs) -> Response:
        try:
            dto = ArtistCreateDTO(**request.data)
        except ValidationError as e:
            return make_error_response(
                request,
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="validation_error",
                detail="The submitted data is invalid.",
                validation_errors=format_pydantic_validation_errors(e),
            )

        try:
            artist = ArtistHRService.provision_artist(dto)
            return Response(self.get_serializer(artist).data, status=status.HTTP_201_CREATED)
        except ArtistProvisioningException as e:
            # The only thing provisioning rejects is a duplicate email, so say
            # exactly that — a stable `email_taken` code the client maps to clear
            # copy, plus a field error so the email input lights up inline,
            # instead of the old opaque 409 that read as a generic "conflict".
            logger.info("artist_provision_rejected email_in_use: %s", e)
            return make_error_response(
                request,
                status_code=status.HTTP_409_CONFLICT,
                error_code="email_taken",
                detail=str(e),
                validation_errors={"email": [str(e)]},
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def archive(self, request, pk=None) -> Response:
        """Executes a Soft Delete (Archiving) of an Artist."""
        artist = self.get_object()
        ArtistHRService.archive_artist(artist)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def restore(self, request, pk=None) -> Response:
        """Restores a previously archived Artist."""
        try:
            artist = Artist.all_objects.get(pk=pk)
        except Artist.DoesNotExist:
            return Response({"detail": "Archived artist not found."}, status=status.HTTP_404_NOT_FOUND)
            
        ArtistHRService.restore_artist(artist)
        return Response(self.get_serializer(artist).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsManager],
        throttle_classes=[ResendActivationThrottle],
        url_path='resend-activation',
    )
    def resend_activation(self, request, pk=None) -> Response:
        """Re-sends the account-activation invite to an artist who was invited
        but never activated (e.g. lost the original email). Manager-only. The
        service refuses already-activated accounts, surfacing a stable
        `account_already_active` code the client maps to clear copy."""
        artist = self.get_object()
        ArtistHRService.resend_activation(artist)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def me(self, request) -> Response:
        artist = Artist.objects.filter(user=request.user).first()
        if not artist:
            return Response(None, status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(artist).data)

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def dossier(self, request, pk=None) -> Response:
        """Read-only HR dossier: project track record, casting history and
        attendance reliability, aggregated from relational state. Resolves
        against all_objects so an archived artist's history stays reachable."""
        try:
            artist = Artist.all_objects.get(pk=pk)
        except Artist.DoesNotExist:
            return Response({"detail": "Artist not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_artist_dossier(artist))


class ProjectViewSet(viewsets.ModelViewSet):
    """
    Project Orchestration.
    Write operations restricted to Managers. Artists only see projects they are cast in.
    """
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        user = request_user(self.request)
        now = timezone.now()
        
        _active_parts = Q(participations__is_deleted=False)
        base_qs = Project.objects.select_related('conductor', 'location').prefetch_related(
            'participations__artist',
            'program_items__piece',
        ).annotate(
            rehearsals_total=Count('rehearsals', distinct=True),
            rehearsals_upcoming=Count(
                'rehearsals',
                filter=Q(rehearsals__date_time__gt=now),
                distinct=True
            ),
            cast_total=Count('participations', filter=_active_parts, distinct=True),
            cast_confirmed=Count(
                'participations',
                filter=_active_parts & Q(participations__status='CON'),
                distinct=True
            ),
            cast_pending=Count(
                'participations',
                filter=_active_parts & Q(participations__status='INV'),
                distinct=True
            ),
            cast_declined=Count(
                'participations',
                filter=_active_parts & Q(participations__status='DEC'),
                distinct=True
            ),
            pieces_total=Count('program_items', distinct=True),
            crew_total=Count('crew_assignments', distinct=True)
        )
        
        if _is_manager(user): 
            return base_qs.all()
            
        return base_qs.filter(participations__artist__user=user).distinct()
    
    def create(self, request, *args, **kwargs) -> Response:
        try:
            dto = ProjectCreateDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        project = ProjectManagementService.create_project_with_creator(user=request.user, dto=dto)
        return Response(self.get_serializer(project).data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs) -> Response:
        project = self.get_object()
        try:
            dto = ProjectUpdateDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        updated_project = ProjectManagementService.update_project(project, dto)
        return Response(self.get_serializer(updated_project).data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs) -> Response:
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def roster(self, request, pk=None) -> Response:
        project = self.get_object()
        participations = Participation.objects.filter(project=project, is_deleted=False).select_related('artist')
        roster_data = [
            {"id": p.artist.id, "name": f"{p.artist.first_name} {p.artist.last_name}", "voice_type": p.artist.get_voice_type_display()}
            for p in participations
        ]
        return Response(roster_data)
    
    @action(detail=True, methods=['get', 'post', 'delete'], url_path='score_pdf',
            permission_classes=[permissions.IsAuthenticated])
    def score_pdf(self, request, pk=None) -> Response | FileResponse:
        """
        Manages the project score PDF.
        GET  — All authenticated users who have access to this project.
        POST — Managers only. Multipart upload with field name 'score_pdf'.
        DELETE — Managers only. Clears the stored file.
        """
        from django.core.exceptions import ValidationError as DjangoValidationError

        project = self.get_object()

        if request.method == 'GET':
            # Choristers lose access to the concert score once the project is
            # completed or cancelled — the score is the conductor's property and
            # is not retained on personal devices via the app after the event.
            if not _is_manager(request.user) and project.status in _CLOSED_PROJECT_STATUSES:
                return Response(
                    {"detail": "Score access for this project has closed."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if not project.score_pdf:
                return Response(
                    {"detail": "This project has no score PDF."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            is_manager = _is_manager(request.user)
            # A singer downloading the book is the moment it "leaves the building";
            # flag it so the conductor's cockpit warns before a rebuild silently
            # replaces what is already in their folders. Managers previewing it do
            # not count as distribution. (Unchanged by watermarking.)
            if not is_manager:
                ScorePackageService.mark_distributed(project)

            # The binder physically contains the licensed editions' pages, so it is
            # watermarked whenever ANY bound edition is protected — protecting the
            # single editions without protecting the book they compose is worthless.
            protected = ScorePackageService.uses_protected_edition(project)
            build_version = (
                ScorePackage.objects.filter(project=project)
                .values_list('build_version', flat=True)
                .first()
            )
            decision = record_binder_access(
                request.user, project,
                build_version=build_version, protected=protected, is_manager=is_manager,
            )
            filename = f"Score_{project.title.replace(' ', '_')}.pdf"

            if not decision.watermark:
                try:
                    file_handle = project.score_pdf.open('rb')
                except OSError:
                    return Response(
                        {"detail": "Score PDF file not found on the server."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                response = FileResponse(
                    file_handle,
                    content_type='application/pdf',
                    filename=filename,
                )
                response['Access-Control-Expose-Headers'] = 'Content-Disposition'
                return response

            # Protected + chorister: stamp the personal watermark before serving.
            try:
                with project.score_pdf.open('rb') as handle:
                    raw = handle.read()
            except OSError:
                return Response(
                    {"detail": "Score PDF file not found on the server."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            footer = build_watermark_footer(
                copy_number=decision.copy_number,
                holder_name=copy_holder_name(request.user),
                context_label=project.title,
                when=timezone.now(),
            )
            cache_key = (
                f"score_wm:binder:{project.pk}:{build_version}:"
                f"{request.user.pk}:{decision.copy_number}"
            )
            try:
                stamped = _watermarked_pdf(raw, cache_key=cache_key, footer_text=footer)
            except DocumentRenderDependencyError:
                raise PdfRenderUnavailable() from None
            return _pdf_bytes_response(stamped, filename=filename)

        if not _is_manager(request.user):
            return Response(
                {"detail": "Manager access required to modify the score PDF."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == 'DELETE':
            if project.score_pdf:
                project.score_pdf.delete(save=False)
                project.score_pdf = None
                project.save(update_fields=['score_pdf', 'updated_at'])
                # Keep the score-package read model in step with the cleared file.
                ScorePackageService.mark_score_cleared(project)
            return Response(status=status.HTTP_204_NO_CONTENT)

        # POST — upload a new PDF
        if 'score_pdf' not in request.FILES:
            return Response(
                {"error": "A 'score_pdf' file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES['score_pdf']

        # Run model-level validators (extension + size) before persisting
        score_pdf_field = project._meta.get_field('score_pdf')
        try:
            for validator in score_pdf_field.validators:
                validator(uploaded_file)
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        if project.score_pdf:
            project.score_pdf.delete(save=False)

        project.score_pdf = uploaded_file
        project.save(update_fields=['score_pdf', 'updated_at'])
        # Reconcile the cockpit: this hand-uploaded file is the current book, so the
        # generator's version/staleness must not be shown over it.
        ScorePackageService.mark_manual_upload(project)

        return Response(self.get_serializer(project).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='score_package', permission_classes=[IsManager])
    def score_package(self, request, pk=None) -> Response:
        """
        Concert score-book generator (conductor cockpit). Manager-only.

        GET  — build state: status, staleness, page count, and per-piece readiness
               (which program pieces still lack a bindable PDF).
        POST — queue an (re)assembly. Optional layout settings in the JSON body
               (`density_mode`, `include_title_page`, `include_toc`,
               `include_page_numbers`, `include_bookmarks`, `normalize_to_a4`).
               The finished PDF is served through the existing `score_pdf` action.
        """
        project = self.get_object()

        if request.method == 'POST':
            config_patch = request.data if isinstance(request.data, dict) else {}
            ScorePackageService.request_generation(project, config_patch)
            return Response(
                ScorePackageService.compute_state(project),
                status=status.HTTP_202_ACCEPTED,
            )

        return Response(ScorePackageService.compute_state(project))

    @action(detail=True, methods=['patch'], url_path='score_package/config', permission_classes=[IsManager])
    def score_package_config(self, request, pk=None) -> Response:
        """
        Persist the global layout settings (density, card content, structure, A4,
        translation language) without queuing a build, and return the recomputed
        cockpit state. Manager-only.
        """
        project = self.get_object()
        patch = request.data if isinstance(request.data, dict) else {}
        return Response(ScorePackageService.update_config(project, patch))

    @action(detail=True, methods=['patch'], url_path='score_package/item', permission_classes=[IsManager])
    def score_package_item(self, request, pk=None) -> Response:
        """
        Persist one program item's build-cockpit overrides (edition, page-range
        trim, card elements + per-item text/note overrides) and return the
        recomputed cockpit state. Manager-only.

        Body: ``{"item_id": "<uuid>", ...overrides}``.
        """
        project = self.get_object()
        body = request.data if isinstance(request.data, dict) else {}
        item_id = body.get('item_id')
        if not item_id:
            return Response({"detail": "item_id jest wymagane."}, status=status.HTTP_400_BAD_REQUEST)
        patch = {k: v for k, v in body.items() if k != 'item_id'}
        try:
            state = ScorePackageService.update_item(project, str(item_id), patch)
        except ScorePackageItemError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(state)

    @action(detail=True, methods=['get'], url_path='score_package/preview', permission_classes=[IsManager])
    def score_package_preview(self, request, pk=None) -> Response | FileResponse:
        """
        Live card preview for the build cockpit: render one program item's
        frontispiece/placeholder card to a PDF and stream it inline. Manager-only.

        Query: ``?item=<uuid>``.
        """
        project = self.get_object()
        item_id = request.query_params.get('item')
        if not item_id:
            return Response({"detail": "item jest wymagane."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            pdf_bytes = ScorePackageService.render_item_preview(project, str(item_id))
        except ScorePackageItemError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except DocumentRenderDependencyError as exc:
            raise PdfRenderUnavailable() from exc
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        response = FileResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="card_preview.pdf"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], url_path='score_package/thumbnails', permission_classes=[IsManager])
    def score_package_thumbnails(self, request, pk=None) -> Response:
        """
        Page thumbnails for a program item's resolved edition, powering the build
        cockpit's visual page-range trimming. Manager-only; the edition is resolved
        server-side from the item, so a client cannot request a foreign score's
        pages. Always 200: an empty strip means no readable edition, ``available``
        ``False`` means the host has no rasteriser (the cockpit keeps manual entry).

        Query: ``?item=<uuid>``.
        """
        project = self.get_object()
        item_id = request.query_params.get('item')
        if not item_id:
            return Response({"detail": "item jest wymagane."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            manifest = ScorePackageService.thumbnails_for_item(project, str(item_id))
        except ScorePackageItemError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(manifest)

    @action(detail=True, methods=['get'], url_path='readiness-summary', permission_classes=[IsManager])
    def readiness_summary(self, request, pk=None) -> Response:
        """
        Conductor pre-rehearsal heatmap: per program piece, counts of cast
        singers who reported READY / IN_PROGRESS, with the remainder NOT_STARTED.
        """
        project = self.get_object()
        return Response(PieceReadinessService.get_project_readiness_summary(project))

    @staticmethod
    def _call_sheet_querysets(project: Project):
        """Shared, fully-prefetched querysets feeding the concert-day sheet.
        Used by both the production export and the personalized day sheet."""
        participations = (
            Participation.objects
            .filter(project=project, is_deleted=False)
            .select_related('artist')
            .order_by('artist__last_name')
        )
        crew = CrewAssignment.objects.filter(project=project).select_related('collaborator')
        program = (
            ProgramItem.objects
            .filter(project=project)
            .select_related('piece', 'piece__composer')
            .prefetch_related(
                Prefetch(
                    'piece__tracks',
                    queryset=Track.objects.filter(is_deleted=False).order_by('voice_part'),
                    to_attr='prefetched_tracks',
                ),
                Prefetch(
                    'piece__voice_requirements',
                    queryset=PieceVoiceRequirement.objects.filter(is_deleted=False).order_by('voice_line'),
                    to_attr='prefetched_voice_requirements',
                ),
                Prefetch(
                    'piece__editions',
                    queryset=ScoreEdition.objects.filter(is_deleted=False).order_by('-is_default', '-created_at'),
                    to_attr='prefetched_editions',
                ),
                Prefetch(
                    'piece__recordings',
                    queryset=Recording.objects.filter(is_deleted=False).order_by('-is_featured', 'source'),
                    to_attr='prefetched_recordings',
                ),
            )
            .order_by('order')
        )
        rehearsals = (
            Rehearsal.objects
            .filter(project=project, is_deleted=False)
            .select_related('location')
            .prefetch_related('invited_participations__artist')
            .order_by('date_time')
        )
        castings = (
            ProjectPieceCasting.objects
            .filter(participation__project=project, participation__is_deleted=False)
            .select_related('piece', 'participation__artist')
            .order_by('piece__title', 'voice_line', 'participation__artist__last_name')
        )
        return participations, crew, program, rehearsals, castings

    def _render_call_sheet(
        self,
        request,
        project: Project,
        audience: Audience,
        recipient: Participation | None,
        filename_stub: str,
    ) -> FileResponse | Response:
        """Renders the day sheet for a resolved audience, degrading gracefully
        if the PDF engine's native libraries are unavailable (rather than 500)."""
        participations, crew, program, rehearsals, castings = self._call_sheet_querysets(project)
        try:
            pdf_bytes = DocumentGenerator.generate_call_sheet_pdf(
                project,
                participations,
                crew,
                program,
                rehearsals,
                castings,
                audience=audience,
                recipient=recipient,
                base_url=request.build_absolute_uri('/'),
            )
        except DocumentRenderDependencyError:
            logger.exception("Call sheet render failed: WeasyPrint native dependencies missing")
            return Response(
                {"detail": _("Generator PDF jest chwilowo niedostępny. Spróbuj ponownie za chwilę.")},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        safe_title = project.title.replace(' ', '_')
        response = FileResponse(
            buffer,
            as_attachment=True,
            filename=f"{filename_stub}_{safe_title}.pdf",
            content_type='application/pdf',
        )
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def export_call_sheet(self, request, pk=None) -> FileResponse | Response:
        """Full production call sheet — managers only. Complete logistics,
        casting, coverage metrics and the operational contact directory."""
        project = self.get_object()
        return self._render_call_sheet(
            request, project, Audience.PRODUCTION, recipient=None, filename_stub="CallSheet",
        )

    @staticmethod
    def _resolve_day_sheet_audience(
        project: Project,
        user,
    ) -> tuple[Audience | None, Participation | None]:
        """Maps the requesting user to the day sheet they're entitled to:
        the maestro gets the conductor sheet, a cast singer gets their own
        personalized sheet, everyone else is denied (managers use the full
        production export instead)."""
        if project.conductor_id and project.conductor and project.conductor.user_id == user.id:
            return Audience.CONDUCTOR, None
        recipient = (
            Participation.objects
            .filter(project=project, artist__user=user, is_deleted=False)
            .exclude(status=Participation.Status.DECLINED)
            .select_related('artist')
            .first()
        )
        if recipient is not None:
            return Audience.CHORISTER, recipient
        return None, None

    @action(
        detail=True,
        methods=['get'],
        url_path='export_day_sheet',
        permission_classes=[permissions.IsAuthenticated],
    )
    def export_day_sheet(self, request, pk=None) -> FileResponse | Response:
        """Personalized concert-day sheet for the people performing it.

        Unlike the manager-only production export, this is scoped to the
        recipient: a cast singer receives their own sheet (their voice, casting
        and pitch duties; no private contact directory), and the project's
        conductor receives the music-forward maestro sheet. Not tied to
        ``get_queryset`` on purpose — a conductor who isn't a participant would
        otherwise be invisible to the project scope.
        """
        project = get_object_or_404(
            Project.objects.select_related('conductor', 'location'),
            pk=pk,
        )
        user = request_user(request)
        audience, recipient = self._resolve_day_sheet_audience(project, user)
        if audience is None:
            raise PermissionDenied(
                _("Nie masz dostępu do karty tego wydarzenia.")
            )
        return self._render_call_sheet(
            request, project, audience, recipient, filename_stub="Karta",
        )

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def export_zaiks(self, request, pk=None) -> StreamingHttpResponse:
        project = self.get_object()
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')
        response = StreamingHttpResponse(DocumentGenerator.generate_zaiks_csv_iterator(program), content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="ZAiKS_{project.title.replace(" ", "_")}.csv"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def export_dtp(self, request, pk=None) -> HttpResponse:
        project = self.get_object()
        participations = Participation.objects.filter(project=project, is_deleted=False).select_related('artist').order_by('artist__last_name')
        content = DocumentGenerator.generate_dtp_export_text(project, participations)
        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="Sklad_DTP_{project.title.replace(" ", "_")}.txt"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ParticipationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly] 
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'artist', 'status']

    def get_queryset(self):
        user = request_user(self.request)
        qs = Participation.objects.select_related('artist__user', 'artist', 'project').all()
        return qs if _is_manager(user) else qs.filter(artist__user=user)

    def get_serializer_class(self):
        return ParticipationDetailedSerializer if _is_manager(self.request.user) else ParticipationBasicSerializer
    
    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participation = ProjectManagementService.create_or_restore_participation(serializer.validated_data)
        return Response(self.get_serializer(participation).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance) -> None:
        ProjectManagementService.delete_participation(instance)

    @action(detail=False, methods=['get'], url_path='materials-dashboard')
    def materials_dashboard(self, request) -> Response:
        """
        Read-only materials tree for the authenticated user.
        Returns the full project → program → piece hierarchy for every project
        the user sings in (their participations, with personalised castings and
        readiness) *and* every project they conduct (full cast, no self-report),
        each resolved in a fixed number of SQL queries via pre-fetched to_attr
        lists. Both slices share the row shape; conductor rows carry
        `is_conducting: true` and a null participation.
        """
        user = request_user(request)
        ctx = {'request': request}
        sung = ParticipationMaterialsSerializer(
            get_artist_materials_queryset(user),
            many=True,
            context=ctx,
        ).data
        conducted = ConductedProjectMaterialsSerializer(
            get_conductor_materials_projects(user),
            many=True,
            context=ctx,
        ).data
        return Response([*sung, *conducted])

    @action(detail=False, methods=['get'], url_path='schedule-dashboard')
    def schedule_dashboard(self, request) -> Response:
        """
        Pre-joined personal schedule for the authenticated artist: the projects
        they are cast in and the rehearsals they are invited to, each carrying
        their own participation id and (for rehearsals) their attendance. The
        server owns the join so the client never re-joins four collections.
        Returns a flat, discriminated list of {type: PROJECT|REHEARSAL, ...}.
        """
        projects_qs, rehearsals_qs, participation_by_project = get_artist_schedule(
            request_user(request)
        )
        ctx = {'request': request}

        items: list[dict] = [
            {
                'type': 'PROJECT',
                'participation_id': participation_by_project.get(str(project['id'])),
                'project': project,
            }
            for project in ProjectSerializer(projects_qs, many=True, context=ctx).data
        ]

        rehearsal_objs = list(rehearsals_qs)
        rehearsal_data = RehearsalSerializer(rehearsal_objs, many=True, context=ctx).data
        for reh_obj, rehearsal in zip(rehearsal_objs, rehearsal_data, strict=True):
            my_attendances = getattr(reh_obj, 'my_attendances', None) or []
            mine = my_attendances[0] if my_attendances else None
            items.append({
                'type': 'REHEARSAL',
                'participation_id': participation_by_project.get(str(reh_obj.project_id)),
                'project_title': reh_obj.project.title,
                'my_attendance': (
                    {
                        'id': str(mine.id),
                        'status': mine.status,
                        'excuse_note': mine.excuse_note,
                    }
                    if mine
                    else None
                ),
                'rehearsal': rehearsal,
            })

        return Response(items)

    @action(detail=True, methods=['put'], url_path='readiness', permission_classes=[permissions.IsAuthenticated])
    def readiness(self, request, pk=None) -> Response:
        """
        Artist self-report: upserts practice readiness for one piece of this
        participation. Managers may set readiness on any participation.
        """
        participation = self.get_object()

        if not _is_manager(request.user) and participation.artist.user_id != request.user.id:
            return Response(
                {"detail": "You do not have permission to modify readiness for this participation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            dto = PieceReadinessUpdateDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        entry = PieceReadinessService.upsert_readiness(participation, dto)
        return Response(
            {"piece": str(entry.piece_id), "status": entry.status, "updated_at": entry.updated_at},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsManager])
    def bulk_fee(self, request) -> Response:
        try:
            dto = ProjectBulkFeeDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = ProjectManagementService.update_project_bulk_fee(dto)
        return Response({"detail": f"Successfully updated {updated_count} records.", "updated_count": updated_count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='status', permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None) -> Response:
        """
        Endpoint for artists to update their own participation status (e.g., Accept/Decline invitation).
        Managers can update any status.
        """
        participation = self.get_object()
        
        if not _is_manager(request.user) and participation.artist.user_id != request.user.id:
            return Response(
                {"detail": "You do not have permission to modify this participation status."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            dto = ParticipationStatusUpdateDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        updated_participation = ParticipationService.update_status_by_artist(participation, dto.status)

        return Response(self.get_serializer(updated_participation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def contract(self, request, pk=None) -> FileResponse:
        """Renders and streams the individual legal contract PDF for one cast member."""
        return _settlement_contract_response(self.get_object())

    @action(detail=True, methods=['patch'], permission_classes=[IsManager])
    def payment(self, request, pk=None) -> Response:
        """Marks this participation's fee as settled / unsettled (manager-only)."""
        record = self.get_object()
        is_paid = request.data.get('is_paid')
        if not isinstance(is_paid, bool):
            return Response({"detail": "Field 'is_paid' must be a boolean."}, status=status.HTTP_400_BAD_REQUEST)
        _apply_payment(record, is_paid)
        return Response(self.get_serializer(record).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsManager])
    def fee(self, request, pk=None) -> Response:
        """Sets (or clears) the remuneration on one participation (manager-only)."""
        return _fee_action(self, request)

    @action(detail=False, methods=['post'], url_path='request_project_zip', permission_classes=[IsManager])
    def request_project_zip(self, request) -> Response:
        """Kicks off the background ZIP export of all contract PDFs for a project."""
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"detail": "Field 'project_id' is required."}, status=status.HTTP_400_BAD_REQUEST)

        task = generate_project_zip_task.delay(str(project_id))
        return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], url_path='check_zip_status', permission_classes=[IsManager])
    def check_zip_status(self, request) -> Response:
        """Polls the Celery task backing a project ZIP export and normalizes its state."""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({"detail": "Query param 'task_id' is required."}, status=status.HTTP_400_BAD_REQUEST)

        result = AsyncResult(task_id)
        state = result.state
        payload: dict = {"state": state}

        if state == 'SUCCESS':
            data = result.result if isinstance(result.result, dict) else {}
            if data.get('error'):
                # The task completed but found nothing to package — surface as a failure
                # so the frontend shows an actionable message instead of an empty download.
                payload['state'] = 'FAILURE'
                payload['error'] = 'Projekt nie ma przypisanej obsady ani ekipy do wygenerowania umów.'
            else:
                payload['file_url'] = data.get('download_url')
        elif state in ('FAILURE', 'FAILED'):
            payload['error'] = 'Generowanie paczki nie powiodło się. Spróbuj ponownie.'

        return Response(payload, status=status.HTTP_200_OK)


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rehearsal', 'participation', 'rehearsal__project', 'participation__artist']

    def get_queryset(self):
        qs = Attendance.objects.select_related('rehearsal', 'rehearsal__project', 'participation', 'participation__artist', 'participation__artist__user')
        if _is_manager(self.request.user):
            return qs
        return qs.filter(participation__artist__user=request_user(self.request))

    def create(self, request, *args, **kwargs) -> Response:
        try:
            dto = AttendanceRecordDTO(
                requesting_user_id=request.user.id,
                is_manager=_is_manager(request.user),
                **request.data
            )
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            attendance = RehearsalOperationsService.record_attendance(dto)
            return Response(self.get_serializer(attendance).data, status=status.HTTP_201_CREATED)
        except AttendanceValidationException as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RehearsalViewSet(viewsets.ModelViewSet):
    serializer_class = RehearsalSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'invited_participations__artist']

    def get_queryset(self):
        user = request_user(self.request)
        absent_annotation = Count('attendances', filter=Q(attendances__status__in=['ABSENT', 'EXCUSED']))
        qs = Rehearsal.objects.select_related('project').prefetch_related(
            'invited_participations', 'invited_participations__artist'
        ).annotate(absent_count=absent_annotation)

        if _is_manager(user):
            return qs
        return qs.filter(project__participations__artist__user=user).filter(
            Q(invited_participations__isnull=True) | Q(invited_participations__artist__user=user)
        ).distinct()

    @staticmethod
    def _build_create_dto_payload(validated_data):
        return {
            "project_id": validated_data["project"].id,
            "date_time": validated_data["date_time"],
            "timezone": validated_data["timezone"],
            "location_id": validated_data.get("location").id if validated_data.get("location") else None,
            "focus": validated_data.get("focus", ""),
            "is_mandatory": validated_data.get("is_mandatory", True),
        }

    @staticmethod
    def _build_update_dto_payload(validated_data):
        payload = {}

        if "date_time" in validated_data:
            payload["date_time"] = validated_data["date_time"]

        if "timezone" in validated_data:
            payload["timezone"] = validated_data["timezone"]

        if "location" in validated_data:
            payload["location_id"] = (
                validated_data["location"].id if validated_data["location"] else None
            )

        if "focus" in validated_data:
            payload["focus"] = validated_data["focus"]

        if "is_mandatory" in validated_data:
            payload["is_mandatory"] = validated_data["is_mandatory"]

        return payload

    def create(self, request, *args, **kwargs) -> Response:
        # 1. Validate HTTP payload and relational references via DRF
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 2. Validate Domain Data via Pydantic
        try:
            dto = RehearsalCreateDTO(**self._build_create_dto_payload(serializer.validated_data))
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Extract validated Many-To-Many relations
        invited = serializer.validated_data.get('invited_participations', None)

        # 4. Delegate to Strict Service Layer
        rehearsal = RehearsalOperationsService.schedule_rehearsal(dto=dto, invited_participations=invited)
        return Response(self.get_serializer(rehearsal).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs) -> Response:
        rehearsal = self.get_object()

        serializer = self.get_serializer(rehearsal, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        try:
            dto = RehearsalUpdateDTO(**self._build_update_dto_payload(serializer.validated_data))
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        invited = serializer.validated_data.get('invited_participations', None)
        
        updated_rehearsal = RehearsalOperationsService.update_rehearsal(
            rehearsal=rehearsal, 
            dto=dto, 
            invited_participations=invited
        )
        return Response(self.get_serializer(updated_rehearsal).data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs) -> Response:
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance) -> None:
        RehearsalOperationsService.delete_rehearsal(instance)

class ProgramItemViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'piece']

    def get_queryset(self):
        # Data partitioning: a chorister may read the setlist only for projects
        # they are cast in — never the whole organisation's programming.
        qs = ProgramItem.objects.select_related('piece').order_by('order')
        if _is_manager(self.request.user):
            return qs
        return qs.filter(
            project__participations__artist__user=request_user(self.request),
            project__participations__is_deleted=False,
        ).distinct()


class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectPieceCastingSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'participation__project', 'participation']

    def get_queryset(self):
        # Data partitioning: a chorister sees the divisi (and casting notes) only
        # for projects they are cast in, mirroring ProgramItem/Project scoping.
        qs = ProjectPieceCasting.objects.all()
        if _is_manager(self.request.user):
            return qs
        return qs.filter(
            participation__project__participations__artist__user=request_user(self.request),
            participation__project__participations__is_deleted=False,
        ).distinct()

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            casting = CastingAndCrewService.assign_piece_casting(serializer.validated_data)
        except CastingValidationException as exc:
            return Response({"error": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        return Response(self.get_serializer(casting).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer) -> None:
        CastingAndCrewService.update_piece_casting(serializer.instance, serializer.validated_data)

    def perform_destroy(self, instance) -> None:
        CastingAndCrewService.delete_piece_casting(instance)


class CollaboratorViewSet(viewsets.ModelViewSet):
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]

    def get_serializer_class(self):
        # Contact PII (email / phone) is manager-only, mirroring the crew and
        # participation serializers. Non-managers get the PII-stripped payload.
        return CollaboratorSerializer if _is_manager(self.request.user) else CollaboratorBasicSerializer


class CrewAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CrewAssignment.objects.all()
    serializer_class = CrewAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'collaborator']

    def get_queryset(self):
        # A chorister may see who the crew are on their own projects, but not the
        # crew bookings of projects they have nothing to do with.
        qs = CrewAssignment.objects.all()
        if _is_manager(self.request.user):
            return qs
        return qs.filter(
            project__participations__artist__user=request_user(self.request),
            project__participations__is_deleted=False,
        ).distinct()

    def get_serializer_class(self):
        # Financial fields (fee / is_paid / paid_at) are manager-only, mirroring
        # the participation serializers. Non-managers get the basic payload.
        return CrewAssignmentSerializer if _is_manager(self.request.user) else CrewAssignmentBasicSerializer

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = CastingAndCrewService.assign_crew(serializer.validated_data)
        return Response(self.get_serializer(assignment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def contract(self, request, pk=None) -> FileResponse:
        """Renders and streams the individual legal contract PDF for one crew member."""
        return _settlement_contract_response(self.get_object())

    @action(detail=True, methods=['patch'], permission_classes=[IsManager])
    def payment(self, request, pk=None) -> Response:
        """Marks this crew assignment's fee as settled / unsettled (manager-only)."""
        record = self.get_object()
        is_paid = request.data.get('is_paid')
        if not isinstance(is_paid, bool):
            return Response({"detail": "Field 'is_paid' must be a boolean."}, status=status.HTTP_400_BAD_REQUEST)
        _apply_payment(record, is_paid)
        return Response(self.get_serializer(record).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsManager])
    def fee(self, request, pk=None) -> Response:
        """Sets (or clears) the remuneration on one crew assignment (manager-only)."""
        return _fee_action(self, request)

    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsManager])
    def bulk_fee(self, request) -> Response:
        """Applies one standard rate across a project's crew (skips settled rows)."""
        try:
            dto = ProjectBulkFeeDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = ProjectManagementService.update_project_crew_bulk_fee(dto)
        return Response({"detail": f"Successfully updated {updated_count} records.", "updated_count": updated_count}, status=status.HTTP_200_OK)


class ScoreEditionDownloadView(views.APIView):
    """
    GET /api/materials/scores/<uuid:pk>/download/

    Authenticated, project-scoped, status-aware delivery of a ScoreEdition PDF.
    This is the ONLY chorister-facing path to a score: the raw archive endpoints
    are manager-only and the materials dashboard hands out this URL (never a bare
    /media/ link), so access is re-evaluated on every request. The moment a
    chorister's projects featuring the piece are all closed, the PDF stops
    resolving for them — managers retain access unconditionally.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk) -> Response | FileResponse:
        try:
            edition = ScoreEdition.objects.select_related('piece').get(id=pk, is_deleted=False)
        except ScoreEdition.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not _is_manager(request.user) and not _artist_has_live_access_to_piece(
            request.user, edition.piece_id
        ):
            # Deliberately 404 (not 403): a chorister who has lost access must not
            # even be able to confirm the score still exists on the server.
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not edition.pdf_file:
            return Response({"detail": "No file on this edition."}, status=status.HTTP_404_NOT_FOUND)

        is_manager = _is_manager(request.user)
        # Log every served access (managers included — that trail is the point) and
        # decide clean-vs-watermarked from licence status and role.
        decision = record_edition_access(request.user, edition, is_manager=is_manager)
        filename = os.path.basename(edition.pdf_file.name or '') or 'score.pdf'

        if not decision.watermark:
            # Public domain, or a manager (the licence holder): stream the raw file.
            try:
                file_handle = edition.pdf_file.open('rb')
            except (FileNotFoundError, OSError):
                return Response({"detail": "File not found on storage."}, status=status.HTTP_404_NOT_FOUND)
            response = FileResponse(file_handle, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

        # Protected + chorister: stamp the personal watermark before serving.
        try:
            with edition.pdf_file.open('rb') as handle:
                raw = handle.read()
        except (FileNotFoundError, OSError):
            return Response({"detail": "File not found on storage."}, status=status.HTTP_404_NOT_FOUND)
        footer = build_watermark_footer(
            copy_number=decision.copy_number,
            holder_name=copy_holder_name(request.user),
            context_label=edition.piece.title if edition.piece else '',
            when=timezone.now(),
        )
        cache_key = (
            f"score_wm:edition:{edition.sha256 or edition.pk}:"
            f"{request.user.pk}:{decision.copy_number}"
        )
        try:
            stamped = _watermarked_pdf(raw, cache_key=cache_key, footer_text=footer)
        except DocumentRenderDependencyError:
            raise PdfRenderUnavailable() from None
        return _pdf_bytes_response(stamped, filename=filename)


@api_view(['GET'])
def get_voice_lines(request) -> Response:
    return Response([{"value": choice[0], "label": str(choice[1])} for choice in VoiceLine.choices])

@api_view(['GET'])
def get_voice_types(request) -> Response:
    return Response([{"value": choice[0], "label": str(choice[1])} for choice in VoiceType.choices])
