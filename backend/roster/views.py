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
from django.db.models import Q, Count
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from pydantic import ValidationError
from django.utils import timezone

from core.constants import VoiceLine
from core.permissions import IsManager, IsManagerOrReadOnly, IsOwnerOrManager

from .infrastructure.document_generator import DocumentGenerator

from .dashboard_serializers import ParticipationMaterialsSerializer
from .dtos import (
    ArtistCreateDTO, AttendanceRecordDTO, ProjectBulkFeeDTO,
    ProjectCreateDTO, ProjectUpdateDTO,
    RehearsalCreateDTO, RehearsalUpdateDTO
)
from .queries import get_artist_materials_queryset
from .services import ArtistHRService, ProjectManagementService, RehearsalOperationsService, CastingAndCrewService, ParticipationService

# Models & Exceptions
from .models import Artist, CrewAssignment, Project, Participation, ProgramItem, Rehearsal, Attendance, VoiceType, ProjectPieceCasting, Collaborator
from .exceptions import ArtistProvisioningException, AttendanceValidationException, CastingValidationException

# Serializers
from .serializers import (
    CollaboratorSerializer, CrewAssignmentSerializer, ArtistMeSerializer,
    ProgramItemSerializer, ProjectSerializer, RehearsalSerializer, 
    AttendanceSerializer, ProjectPieceCastingSerializer, ArtistBasicSerializer, 
    ArtistDetailedSerializer, ParticipationBasicSerializer, ParticipationDetailedSerializer, 
)

def _is_manager(user) -> bool:
    """Helper for evaluating manager privileges safely."""
    return hasattr(user, 'profile') and user.profile.is_manager


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
        qs = Artist.objects.select_related('user').all()
        return qs if _is_manager(self.request.user) else qs.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if _is_manager(self.request.user): return ArtistDetailedSerializer
        if self.action == 'me': return ArtistMeSerializer
        return ArtistBasicSerializer
    
    def create(self, request, *args, **kwargs) -> Response:
        try:
            dto = ArtistCreateDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            artist = ArtistHRService.provision_artist(dto)
            return Response(self.get_serializer(artist).data, status=status.HTTP_201_CREATED)
        except ArtistProvisioningException as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)
    
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

    @action(detail=False, methods=['get'])
    def me(self, request) -> Response:
        artist = Artist.objects.filter(user=request.user).first()
        if not artist:
            return Response(None, status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(artist).data)


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
        user = self.request.user
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
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)
            
        project = ProjectManagementService.create_project_with_creator(user=request.user, dto=dto)
        return Response(self.get_serializer(project).data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs) -> Response:
        project = self.get_object()
        try:
            dto = ProjectUpdateDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)
            
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
    def score_pdf(self, request, pk=None) -> Response:
        """
        Manages the project score PDF.
        GET  — All authenticated users who have access to this project.
        POST — Managers only. Multipart upload with field name 'score_pdf'.
        DELETE — Managers only. Clears the stored file.
        """
        from django.core.exceptions import ValidationError as DjangoValidationError

        project = self.get_object()

        if request.method == 'GET':
            if not project.score_pdf:
                return Response(
                    {"detail": "This project has no score PDF."},
                    status=status.HTTP_404_NOT_FOUND,
                )
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
                filename=f"Score_{project.title.replace(' ', '_')}.pdf",
            )
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

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

        return Response(self.get_serializer(project).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsManager])
    def export_call_sheet(self, request, pk=None) -> FileResponse:
        project = self.get_object()
        participations = Participation.objects.filter(project=project, is_deleted=False).select_related('artist').order_by('artist__last_name')
        crew = CrewAssignment.objects.filter(project=project).select_related('collaborator')
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')
        
        pdf_bytes = DocumentGenerator.generate_call_sheet_pdf(project, participations, crew, program)
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        response = FileResponse(buffer, as_attachment=True, filename=f"CallSheet_{project.title.replace(' ', '_')}.pdf", content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

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
        user = self.request.user
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
        Read-only materials tree for the authenticated artist.
        Returns all active participations with the full project → program → piece
        hierarchy, including tracks and castings, resolved in a fixed number of
        SQL queries via pre-fetched to_attr lists.
        """
        queryset = get_artist_materials_queryset(request.user)
        serializer = ParticipationMaterialsSerializer(
            queryset,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsManager])
    def bulk_fee(self, request) -> Response:
        try:
            dto = ProjectBulkFeeDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

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

        new_status = request.data.get('status')
        if not new_status:
            return Response({"error": "The 'status' field is required."}, status=status.HTTP_400_BAD_REQUEST)

        updated_participation = ParticipationService.update_status_by_artist(participation, new_status)
        
        return Response(self.get_serializer(updated_participation).data, status=status.HTTP_200_OK)
    
    

class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rehearsal', 'participation', 'rehearsal__project', 'participation__artist']

    def get_queryset(self):
        qs = Attendance.objects.select_related('rehearsal', 'rehearsal__project', 'participation', 'participation__artist', 'participation__artist__user')
        if _is_manager(self.request.user): return qs
        return qs.filter(participation__artist__user=self.request.user)

    def create(self, request, *args, **kwargs) -> Response:
        try:
            dto = AttendanceRecordDTO(
                requesting_user_id=request.user.id,
                is_manager=_is_manager(request.user),
                **request.data
            )
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)
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
        user = self.request.user
        absent_annotation = Count('attendances', filter=Q(attendances__status__in=['ABSENT', 'EXCUSED']))
        qs = Rehearsal.objects.select_related('project').prefetch_related(
            'invited_participations', 'invited_participations__artist'
        ).annotate(absent_count=absent_annotation)

        if _is_manager(user): return qs
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
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

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
        return ProgramItem.objects.select_related('piece').all().order_by('order')


class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    queryset = ProjectPieceCasting.objects.all()
    serializer_class = ProjectPieceCastingSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'participation__project', 'participation']

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


class CrewAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CrewAssignment.objects.all()
    serializer_class = CrewAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'collaborator'] 

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = CastingAndCrewService.assign_crew(serializer.validated_data)
        return Response(self.get_serializer(assignment).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_voice_lines(request) -> Response:
    return Response([{"value": choice[0], "label": str(choice[1])} for choice in VoiceLine.choices])

@api_view(['GET'])
def get_voice_types(request) -> Response:
    return Response([{"value": choice[0], "label": str(choice[1])} for choice in VoiceType.choices])
