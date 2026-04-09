# roster/views.py
# ==========================================
# Roster API ViewSets (Thin Controllers)
# Standard: Enterprise SaaS 2026
# ==========================================
"""
REST API Controllers for the Roster application.
Strictly handles HTTP protocol parsing, role-based QuerySet routing, and Response formatting. 
Delegates ALL state-mutating business logic to the Service Layer.
"""
import io
from celery.result import AsyncResult
from django.db.models import Q, Count
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.permissions import IsAdminUser
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from pydantic import ValidationError

from core.constants import VoiceLine
from .tasks import generate_project_zip_task
from .infrastructure.document_generator import DocumentGenerator

# Pydantic DTOs
from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectBulkFeeDTO, ParticipationRestoreDTO

# Service Objects
from .services import (
    ArtistHRService, ProjectManagementService, 
    RehearsalOperationsService, CastingAndCrewService
)

# Models & Exceptions
from .models import (
    Artist, CrewAssignment, Project, Participation, ProgramItem, 
    Rehearsal, Attendance, VoiceType, ProjectPieceCasting, Collaborator
)
from .exceptions import ArtistProvisioningException, AttendanceValidationException

# Read-Only Serializers (Used strictly for OUTGOING responses & basic nested writes)
from .serializers import (
    CollaboratorSerializer, CrewAssignmentSerializer, ArtistMeSerializer,
    ProgramItemSerializer, ProjectSerializer, RehearsalSerializer, 
    AttendanceSerializer, ProjectPieceCastingSerializer, ArtistBasicSerializer, 
    ArtistDetailedSerializer, ParticipationBasicSerializer, ParticipationDetailedSerializer, 
)

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS: return True
        return bool(request.user and request.user.is_superuser)


class ArtistViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Artist.objects.select_related('user').all()
        return qs if user.is_superuser else qs.filter(user=user)
    
    def get_serializer_class(self):
        if self.request.user.is_superuser: return ArtistDetailedSerializer
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
    
    @action(detail=False, methods=['get'])
    def me(self, request) -> Response:
        artist = get_object_or_404(Artist, user=request.user)
        return Response(self.get_serializer(artist).data)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        user = self.request.user
        base_qs = Project.objects.prefetch_related('participations__artist', 'program_items__piece')
        if user.is_superuser: return base_qs.all()
        return base_qs.filter(participations__artist__user=user).distinct()
    
    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = ProjectManagementService.create_project_with_creator(user=request.user, validated_data=serializer.validated_data)
        return Response(self.get_serializer(project).data, status=status.HTTP_201_CREATED)
    
    def perform_update(self, serializer) -> None:
        ProjectManagementService.update_project(serializer.instance, serializer.validated_data)

    @action(detail=True, methods=['get'])
    def roster(self, request, pk=None) -> Response:
        project = self.get_object()
        participations = Participation.objects.filter(project=project, is_deleted=False).select_related('artist')
        roster_data = [
            {"id": p.artist.id, "name": f"{p.artist.first_name} {p.artist.last_name}", "voice_type": p.artist.get_voice_type_display()}
            for p in participations
        ]
        return Response(roster_data)
    
    @action(detail=True, methods=['get'])
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

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_zaiks(self, request, pk=None) -> StreamingHttpResponse:
        project = self.get_object()
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')
        response = StreamingHttpResponse(
            DocumentGenerator.generate_zaiks_csv_iterator(program),
            content_type='text/csv; charset=utf-8-sig'
        )
        response['Content-Disposition'] = f'attachment; filename="ZAiKS_{project.title.replace(" ", "_")}.csv"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_dtp(self, request, pk=None) -> HttpResponse:
        project = self.get_object()
        participations = Participation.objects.filter(project=project, is_deleted=False).select_related('artist').order_by('artist__last_name')
        content = DocumentGenerator.generate_dtp_export_text(project, participations)
        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="Sklad_DTP_{project.title.replace(" ", "_")}.txt"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ParticipationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated] 
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'artist', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = Participation.objects.select_related('artist__user', 'artist', 'project').all()
        return qs if user.is_superuser else qs.filter(artist__user=user)

    def get_serializer_class(self):
        return ParticipationDetailedSerializer if self.request.user.is_superuser else ParticipationBasicSerializer
    
    def create(self, request, *args, **kwargs) -> Response:
        try:
            dto = ParticipationRestoreDTO(**request.data)
            restored = ProjectManagementService.handle_soft_deleted_participation(dto)
            if restored:
                return Response(self.get_serializer(restored).data, status=status.HTTP_200_OK)
        except ValidationError:
            pass 

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participation = ProjectManagementService.create_participation(serializer.validated_data)
        return Response(self.get_serializer(participation).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance) -> None:
        ProjectManagementService.delete_participation(instance)

    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsAdminUser])
    def bulk_fee(self, request) -> Response:
        try:
            dto = ProjectBulkFeeDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = ProjectManagementService.update_project_bulk_fee(dto)
        return Response({"detail": f"Successfully updated {updated_count} records.", "updated_count": updated_count}, status=status.HTTP_200_OK)


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rehearsal', 'participation', 'rehearsal__project', 'participation__artist']

    def get_queryset(self):
        qs = Attendance.objects.select_related('rehearsal', 'rehearsal__project', 'participation', 'participation__artist', 'participation__artist__user')
        if self.request.user.is_superuser: return qs
        return qs.filter(participation__artist__user=self.request.user)

    def create(self, request, *args, **kwargs) -> Response:
        try:
            payload = {
                "requesting_user_id": request.user.id,
                "is_superuser": request.user.is_superuser,
                "participation_id": request.data.get('participation'),
                "rehearsal_id": request.data.get('rehearsal'),
                "status": request.data.get('status'),
                "minutes_late": request.data.get('minutes_late'),
                "excuse_note": request.data.get('excuse_note', '')
            }
            dto = AttendanceRecordDTO(**payload)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

        try:
            attendance = RehearsalOperationsService.record_attendance(dto)
            return Response(self.get_serializer(attendance).data, status=status.HTTP_201_CREATED)
        except AttendanceValidationException as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RehearsalViewSet(viewsets.ModelViewSet):
    serializer_class = RehearsalSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'invited_participations__artist']

    def get_queryset(self):
        user = self.request.user
        absent_annotation = Count('attendances', filter=Q(attendances__status__in=['ABSENT', 'EXCUSED']))
        qs = Rehearsal.objects.select_related('project').prefetch_related(
            'invited_participations', 'invited_participations__artist'
        ).annotate(absent_count=absent_annotation)

        if user.is_superuser: return qs
        return qs.filter(project__participations__artist__user=user).filter(
            Q(invited_participations__isnull=True) | Q(invited_participations__artist__user=user)
        ).distinct()

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invited = serializer.validated_data.pop('invited_participations', None)
        rehearsal = RehearsalOperationsService.schedule_rehearsal(serializer.validated_data, invited_participations=invited)
        return Response(self.get_serializer(rehearsal).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs) -> Response:
        """Restored update method routing to the RehearsalOperationsService."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        invited = serializer.validated_data.pop('invited_participations', None)
        
        rehearsal = RehearsalOperationsService.update_rehearsal(instance, serializer.validated_data, invited_participations=invited)
        return Response(self.get_serializer(rehearsal).data)

    def perform_destroy(self, instance) -> None:
        RehearsalOperationsService.delete_rehearsal(instance)


class ProgramItemViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'piece']

    def get_queryset(self):
        return ProgramItem.objects.select_related('piece').all().order_by('order')


class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    queryset = ProjectPieceCasting.objects.all()
    serializer_class = ProjectPieceCastingSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'participation__project', 'participation']

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        casting = CastingAndCrewService.assign_piece_casting(serializer.validated_data)
        return Response(self.get_serializer(casting).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer) -> None:
        CastingAndCrewService.update_piece_casting(serializer.instance, serializer.validated_data)

    def perform_destroy(self, instance) -> None:
        CastingAndCrewService.delete_piece_casting(instance)


class CollaboratorViewSet(viewsets.ModelViewSet):
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class CrewAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CrewAssignment.objects.all()
    serializer_class = CrewAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
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