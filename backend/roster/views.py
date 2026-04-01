# roster/views.py
# ==========================================
# Roster API ViewSets (Controllers)
# ==========================================
"""
REST API Controllers for the Roster application.
@architecture Enterprise SaaS 2026

Strictly handles HTTP protocol parsing, role-based QuerySet routing, and Response 
formatting. All business logic and document generation is delegated to the Service Layer.
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

# Internal imports
from core.constants import VoiceLine
from .tasks import generate_project_zip_task
from . import services  # ENTERPRISE INJECTION: The Service Layer

from .models import (
    Artist, CrewAssignment, Project, Participation, ProgramItem, 
    Rehearsal, Attendance, VoiceType, ProjectPieceCasting, Collaborator
)
from .serializers import (
    CollaboratorSerializer, CrewAssignmentSerializer, ArtistMeSerializer,
    ProgramItemSerializer, ProjectSerializer, RehearsalSerializer, 
    AttendanceSerializer, ProjectPieceCastingSerializer, ArtistBasicSerializer, 
    ArtistDetailedSerializer, ParticipationBasicSerializer, ParticipationDetailedSerializer, 
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Permits unrestricted read-only access, restricts mutations to admins."""
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_superuser)


class ArtistViewSet(viewsets.ModelViewSet):
    """Endpoint for managing Artist profiles and accounts."""
    serializer_class = ArtistBasicSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Artist.objects.select_related('user').all()
        if user.is_superuser:
            return qs
        return qs.filter(user=user)
    
    def get_serializer_class(self):
        """Routing serializers based on authentication level."""
        if self.request.user.is_superuser:
            return ArtistDetailedSerializer
        
        if self.action == 'me':
            return ArtistMeSerializer
        
        return ArtistBasicSerializer
    
    def perform_create(self, serializer):
        """
        Delegates user provisioning and artist creation to the Service Layer.
        Bypasses default DRF save mechanism to enforce transactional integrity.
        """
        data = serializer.validated_data
        
        artist = services.provision_artist_with_user_account(**data)
        
        serializer.instance = artist
    
    @action(detail=False, methods=['get'])
    def me(self, request) -> Response:
        artist = get_object_or_404(Artist, user=request.user)
        serializer = self.get_serializer(artist)
        return Response(serializer.data)


class ProjectViewSet(viewsets.ModelViewSet):
    """Core controller for managing musical production lifecycles."""
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        user = self.request.user
        base_qs = Project.objects.prefetch_related('participations__artist', 'program_items__piece')
        if user.is_superuser:
            return base_qs.all()
        return base_qs.filter(participations__artist__user=user).distinct()
    
    def perform_create(self, serializer):
        """Delegates post-creation hooks to the Service Layer."""
        project = serializer.save()
        services.provision_project_creator_participation(project=project, user=self.request.user)
    
    @action(detail=True, methods=['get'])
    def roster(self, request, pk=None) -> Response:
        project = self.get_object()
        participations = Participation.objects.filter(project=project).select_related('artist')
        roster_data = [
            {
                "id": p.artist.id,
                "name": f"{p.artist.first_name} {p.artist.last_name}",
                "voice_type": p.artist.get_voice_type_display(),
            }
            for p in participations
        ]
        return Response(roster_data)
    
    @action(detail=True, methods=['get'])
    def export_call_sheet(self, request, pk=None) -> FileResponse:
        """Delegates binary PDF generation to the Service Layer."""
        project = self.get_object()
        pdf_bytes = services.generate_call_sheet_pdf(project=project)
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        filename = f"CallSheet_{project.title.replace(' ', '_')}.pdf"
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_zaiks(self, request, pk=None) -> StreamingHttpResponse:
        """Delegates CSV streaming to the Service Layer."""
        project = self.get_object()
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')

        response = StreamingHttpResponse(
            services.generate_zaiks_csv_iterator(program_items=program),
            content_type='text/csv; charset=utf-8-sig'
        )
        response['Content-Disposition'] = f'attachment; filename="ZAiKS_{project.title.replace(" ", "_")}.csv"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_dtp(self, request, pk=None) -> HttpResponse:
        """Delegates string generation to the Service Layer."""
        project = self.get_object()
        content = services.generate_dtp_export_text(project=project)

        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="Sklad_DTP_{project.title.replace(" ", "_")}.txt"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ParticipationViewSet(viewsets.ModelViewSet):
    """Manages contractual and financial relationships."""
    serializer_class = ParticipationBasicSerializer
    permission_classes = [permissions.IsAuthenticated] 
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'artist', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = Participation.objects.select_related('artist__user', 'artist', 'project').all()
        if user.is_superuser:
            return qs
        return qs.filter(artist__user=user)

    def get_serializer_class(self):
        """Routing financial data visibility."""
        if self.request.user.is_superuser:
            return ParticipationDetailedSerializer
        return ParticipationBasicSerializer
    
    def create(self, request, *args, **kwargs):
        """Delegates restoration of soft-deleted records to the Service Layer."""
        artist_id = request.data.get('artist')
        project_id = request.data.get('project')

        restored_participation = services.handle_soft_deleted_participation(
            artist_id=artist_id, 
            project_id=project_id
        )

        if restored_participation:
            serializer = self.get_serializer(restored_participation, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def contract(self, request, pk=None) -> FileResponse:
        """Delegates contract PDF compilation to the Service Layer."""
        participation = self.get_object()
        pdf_bytes = services.generate_participation_contract_pdf(participation=participation)
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        safe_last_name = participation.artist.last_name.replace(' ', '_')
        filename = f"HR-{participation.project.title}-UOG-SUB-{safe_last_name}.pdf"
        
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsAdminUser])
    def bulk_fee(self, request) -> Response:
        """Delegates batch ORM operations to the Service Layer."""
        project_id = request.data.get('project_id')
        fee = request.data.get('fee')

        if not project_id or fee is None:
            return Response({"detail": "Missing project_id or fee."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = services.update_project_bulk_fee(project_id=project_id, new_fee=fee)

        return Response({
            "detail": f"Successfully updated {updated_count} records.",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)

    # ... (Celery zip endpoints remain identical as they just poll task IDs)
    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def request_project_zip(self, request) -> Response:
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "Missing project_id"}, status=status.HTTP_400_BAD_REQUEST)
        task = generate_project_zip_task.delay(project_id)
        return Response({"task_id": task.id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def check_zip_status(self, request) -> Response:
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({"error": "Missing task_id"}, status=status.HTTP_400_BAD_REQUEST)
        result = AsyncResult(task_id)
        
        if result.state == 'SUCCESS':
            task_data = result.result
            if "error" in task_data:
                return Response({"state": "FAILED", "error": task_data["error"]})
            return Response({"state": "SUCCESS", "file_url": task_data.get("download_url"), "message": task_data.get("message")})
        elif result.state == 'FAILURE':
            return Response({"state": "FAILED", "error": str(result.info)})
        return Response({"state": result.state})


class RehearsalViewSet(viewsets.ModelViewSet):
    """Manages rehearsal scheduling and related metadata."""
    serializer_class = RehearsalSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'invited_participations__artist']

    def get_queryset(self):
        user = self.request.user
        
        absent_annotation = Count(
            'attendances', 
            filter=Q(attendances__status__in=['ABSENT', 'EXCUSED'])
        )

        qs = Rehearsal.objects.select_related('project').prefetch_related(
            'invited_participations', 'invited_participations__artist'
        ).annotate(absent_count=absent_annotation) # Magia dzieje się tutaj w SQL

        if user.is_superuser:
            return qs
            
        return qs.filter(project__participations__artist__user=user).filter(
            Q(invited_participations__isnull=True) | Q(invited_participations__artist__user=user)
        ).distinct()


class AttendanceViewSet(viewsets.ModelViewSet):
    """Manages individual attendance tracking and absence justifications."""
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rehearsal', 'participation', 'rehearsal__project', 'participation__artist']

    def get_queryset(self):
        qs = Attendance.objects.select_related(
            'rehearsal', 'rehearsal__project', 'participation', 'participation__artist', 'participation__artist__user'
        )
        if self.request.user.is_superuser:
            return qs
        return qs.filter(participation__artist__user=self.request.user)

    def _extract_instances_for_validation(self, serializer):
        participation = serializer.validated_data.get('participation', serializer.instance.participation if serializer.instance else None)
        rehearsal = serializer.validated_data.get('rehearsal', serializer.instance.rehearsal if serializer.instance else None)
        if participation is None or rehearsal is None:
            raise ValidationError("Attendance records require both participation and rehearsal.")
        return participation, rehearsal

    def perform_create(self, serializer):
        participation, rehearsal = self._extract_instances_for_validation(serializer)
        services.validate_attendance_write(user=self.request.user, participation=participation, rehearsal=rehearsal)
        serializer.save()
        
    def perform_update(self, serializer):
        participation, rehearsal = self._extract_instances_for_validation(serializer)
        services.validate_attendance_write(user=self.request.user, participation=participation, rehearsal=rehearsal)
        serializer.save()


class ProgramItemViewSet(viewsets.ModelViewSet):
    """Manages the ordered setlist (program) of a project."""
    serializer_class = ProgramItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'piece']

    def get_queryset(self):
        return ProgramItem.objects.select_related('piece').all().order_by('order')
    
    def perform_destroy(self, instance):
        """Delegates cascade logic to the Service Layer."""
        services.cascade_delete_program_item(program_item=instance)
    

class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    queryset = ProjectPieceCasting.objects.all()
    serializer_class = ProjectPieceCastingSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'participation__project', 'participation']


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

    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None) -> FileResponse:
        assignment = self.get_object()
        pdf_bytes = services.generate_crew_contract_pdf(assignment=assignment)
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        safe_last_name = assignment.collaborator.last_name.replace(' ', '_')
        filename = f"HR-{assignment.project.id}-CREW-{safe_last_name}.pdf"
        
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


@api_view(['GET'])
def get_voice_lines(request) -> Response:
    choices = [{"value": choice[0], "label": str(choice[1])} for choice in VoiceLine.choices]
    return Response(choices)


@api_view(['GET'])
def get_voice_types(request) -> Response:
    choices = [{"value": choice[0], "label": str(choice[1])} for choice in VoiceType.choices]
    return Response(choices)