# roster/views.py
# ==========================================
# Roster API ViewSets (Controllers)
# ==========================================
"""
REST API Views (Controllers) for the Roster application.
@author Krystian Bugalski

Handles CRUD operations, role-based data isolation via dynamic QuerySet filtering,
and asynchronous task orchestration for binary document generation (PDF/CSV/ZIP).
"""

import io
import csv
import weasyprint

from celery.result import AsyncResult
from django.db.models import Q
from django.utils import timezone
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

# Internal imports
from core.constants import VoiceLine
from .tasks import generate_project_zip_task
from .models import (
    Artist, CrewAssignment, Project, Participation, ProgramItem, 
    Rehearsal, Attendance, VoiceType, ProjectPieceCasting, Collaborator
)
from .serializers import (
    ArtistSerializer, CollaboratorSerializer, CrewAssignmentSerializer, 
    ProgramItemSerializer, ProjectSerializer, ParticipationSerializer, 
    RehearsalSerializer, AttendanceSerializer, ProjectPieceCastingSerializer
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom Permission Architecture:
    Permits unrestricted read-only access (GET/OPTIONS) to authenticated personnel.
    Restricts state mutation operations (POST/PUT/PATCH/DELETE) strictly to administrators.
    """
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_superuser)


def csv_generator(program):
    """Generator for streaming CSV data to prevent RAM exhaustion."""
    yield 'Lp.;Tytuł Utworu;Kompozytor;Aranżer;Czas trwania;Uwagi (BIS)\n'
    
    for idx, item in enumerate(program, 1):
        title = item.piece.title if item.piece else 'Nieznany tytuł'
        
        composer_name = 'Nieznany'
        if item.piece and hasattr(item.piece, 'composer') and item.piece.composer:
            if hasattr(item.piece.composer, 'last_name'):
                composer_name = f"{getattr(item.piece.composer, 'first_name', '')} {item.piece.composer.last_name}".strip()
            else:
                composer_name = str(item.piece.composer)
                
        arranger_name = getattr(item.piece, 'arranger', '-') if item.piece else '-'
        encore = 'BIS' if item.is_encore else ''
        
        yield f'{idx};{title};{composer_name};{arranger_name};;{encore}\n'


class ArtistViewSet(viewsets.ModelViewSet):
    """Endpoint for managing Artist profiles and accounts."""
    serializer_class = ArtistSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """
        Role-based Data Isolation:
        Administrators access the full roster matrix. 
        Base users are restricted to their own operational profile.
        """
        user = self.request.user
        qs = Artist.objects.select_related('user').all()
        
        if user.is_superuser:
            return qs
        return qs.filter(user=user)
    
    @action(detail=False, methods=['get'])
    def me(self, request) -> Response:
        """Custom endpoint returning the dedicated profile mapping of the active authenticated session."""
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
        """
        Implements rigorous QuerySet optimization via prefetch_related 
        to mitigate inherent N+1 database bottlenecks during nested serialization.
        """
        user = self.request.user
        base_qs = Project.objects.prefetch_related(
            'participations__artist', 
            'program_items__piece'
        )
        
        if user.is_superuser:
            return base_qs.all()
        return base_qs.filter(participations__artist__user=user).distinct()
    
    def perform_create(self, serializer):
        """Overrides creation to auto-assign the initializing user as a confirmed participant."""
        project = serializer.save()
        user = self.request.user
        
        if hasattr(user, 'artist_profile'):
            Participation.objects.create(
                artist=user.artist_profile,
                project=project,
                status=Participation.Status.CONFIRMED,
                fee=0 
            )
    
    @action(detail=True, methods=['get'])
    def roster(self, request, pk=None) -> Response:
        """
        Secure endpoint returning the project's cast roster.
        Strictly strips all financial and contractual data to protect confidentiality.
        """
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
        """Compiles and streams an Enterprise-grade PDF Call Sheet via Weasyprint engine."""
        project = self.get_object()
        
        context = {
            'project': project,
            'participations': Participation.objects.filter(project=project).select_related('artist').order_by('artist__last_name'),
            'crew': CrewAssignment.objects.filter(project=project).select_related('collaborator'),
            'program': ProgramItem.objects.filter(project=project).select_related('piece').order_by('order'),
            'generation_date': timezone.now()
        }

        html_string = render_to_string('projects/call_sheet_pdf.html', context)
        pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        filename = f"CallSheet_{project.title.replace(' ', '_')}.pdf"
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_zaiks(self, request, pk=None) -> StreamingHttpResponse:
        """Compiles and streams a UTF-8 BOM formatted CSV payload for ZAiKS copyright reporting."""
        project = self.get_object()
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')

        response = StreamingHttpResponse(
            csv_generator(program),
            content_type='text/csv; charset=utf-8-sig'
        )
        response['Content-Disposition'] = f'attachment; filename="ZAiKS_{project.title.replace(" ", "_")}.csv"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_dtp(self, request, pk=None) -> HttpResponse:
        """Generates a cleanly formatted text artifact tailored for Graphic Design (DTP) integration."""
        project = self.get_object()
        participations = Participation.objects.filter(project=project).select_related('artist').order_by('artist__last_name')

        groups = {'Soprany': [], 'Alty': [], 'Tenory': [], 'Basy': [], 'Inne': []}
        for p in participations:
            vt = p.artist.voice_type or ''
            if vt.startswith('S'): groups['Soprany'].append(p.artist)
            elif vt.startswith('A') or vt == 'MEZ': groups['Alty'].append(p.artist)
            elif vt.startswith('T') or vt == 'CT': groups['Tenory'].append(p.artist)
            elif vt.startswith('B'): groups['Basy'].append(p.artist)
            else: groups['Inne'].append(p.artist)

        context = {
            'project': project,
            'groups': groups,
            'generation_date': timezone.now()
        }
        
        content = render_to_string('projects/dtp_export.txt', context)

        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="Sklad_DTP_{project.title.replace(" ", "_")}.txt"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ParticipationViewSet(viewsets.ModelViewSet):
    """Manages contractual and financial relationships between Artists and Projects."""
    serializer_class = ParticipationSerializer
    permission_classes = [permissions.IsAuthenticated] 
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'artist', 'status']

    def get_queryset(self):
        """
        ROW-LEVEL SECURITY (RLS):
        Superusers view all participations globally.
        Standard artists receive only records bound strictly to their user ID.
        """
        user = self.request.user
        qs = Participation.objects.select_related('artist__user', 'artist', 'project').all()
        
        if user.is_superuser:
            return qs
        return qs.filter(artist__user=user)

    def create(self, request, *args, **kwargs):
        """Custom creation logic to handle 'Soft Delete' restoration."""
        artist_id = request.data.get('artist')
        project_id = request.data.get('project')

        deleted_participation = Participation.all_objects.filter(
            artist_id=artist_id, 
            project_id=project_id, 
            is_deleted=True
        ).first()

        if deleted_participation:
            deleted_participation.restore()
            serializer = self.get_serializer(deleted_participation, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def contract(self, request, pk=None) -> FileResponse:
        """Compiles a dynamic legal PDF artifact in real-time bypassing static disk storage."""
        participation = self.get_object()
        artist = participation.artist
        project = participation.project

        context = {
            'artist_name': f"{artist.first_name} {artist.last_name}",
            'voice_type': artist.get_voice_type_display(),
            'project_title': project.title,
            'project_date': project.date_time,
            'project_location': project.location or 'Miejsce do ustalenia',
            'fee': participation.fee or 0,
            'generation_date': timezone.now(),
        }

        html_string = render_to_string('contracts/contract_pdf.html', context)
        pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        safe_last_name = artist.last_name.replace(' ', '_')
        filename = f"HR-{project.title}-UOG-SUB-{safe_last_name}.pdf"
        
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def request_project_zip(self, request) -> Response:
        """
        Delegates bulk document generation processing to a Celery background worker.
        Returns a transactional tracking ID.
        """
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "Missing project_id"}, status=status.HTTP_400_BAD_REQUEST)

        task = generate_project_zip_task.delay(project_id)
        return Response({"task_id": task.id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def check_zip_status(self, request) -> Response:
        """Polling interface providing active status feedback from the designated Celery thread."""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({"error": "Missing task_id"}, status=status.HTTP_400_BAD_REQUEST)

        result = AsyncResult(task_id)
        
        if result.state == 'SUCCESS':
            task_data = result.result
            if "error" in task_data:
                return Response({"state": "FAILED", "error": task_data["error"]})
                
            return Response({
                "state": "SUCCESS", 
                "file_url": task_data.get("download_url"),
                "message": task_data.get("message")
            })
                
        elif result.state == 'FAILURE':
            return Response({"state": "FAILED", "error": str(result.info)})
            
        return Response({"state": result.state})
        
    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsAdminUser])
    def bulk_fee(self, request) -> Response:
        """Executes a highly-optimized batch SQL UPDATE bypassing standard ORM iteration."""
        project_id = request.data.get('project_id')
        fee = request.data.get('fee')

        if not project_id or fee is None:
            return Response(
                {"detail": "Missing project_id or fee."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_count = Participation.objects.filter(project_id=project_id).update(
            fee=fee,
            updated_at=timezone.now()
        )

        return Response({
            "detail": f"Successfully updated {updated_count} records.",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)


class RehearsalViewSet(viewsets.ModelViewSet):
    """Manages rehearsal scheduling and related metadata."""
    serializer_class = RehearsalSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'invited_participations__artist']

    def get_queryset(self):
        user = self.request.user
        qs = Rehearsal.objects.select_related('project').prefetch_related(
            'invited_participations',
            'invited_participations__artist',
        )

        if user.is_superuser:
            return qs

        return qs.filter(
            project__participations__artist__user=user
        ).filter(
            Q(invited_participations__isnull=True) |
            Q(invited_participations__artist__user=user)
        ).distinct()


class AttendanceViewSet(viewsets.ModelViewSet):
    """Manages individual attendance tracking and absence justifications."""
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rehearsal', 'participation', 'rehearsal__project', 'participation__artist']

    def get_queryset(self):
        qs = Attendance.objects.select_related(
            'rehearsal',
            'rehearsal__project',
            'participation',
            'participation__artist',
            'participation__artist__user',
        )

        if self.request.user.is_superuser:
            return qs

        return qs.filter(participation__artist__user=self.request.user)

    def _validate_attendance_write(self, serializer) -> None:
        participation = serializer.validated_data.get(
            'participation',
            serializer.instance.participation if serializer.instance else None,
        )
        rehearsal = serializer.validated_data.get(
            'rehearsal',
            serializer.instance.rehearsal if serializer.instance else None,
        )

        if participation is None or rehearsal is None:
            raise ValidationError("Attendance records require both participation and rehearsal.")

        if participation.project_id != rehearsal.project_id:
            raise ValidationError("Attendance can only be recorded for a rehearsal within the same project.")

        if self.request.user.is_superuser:
            return

        if participation.artist.user_id != self.request.user.id:
            raise PermissionDenied("Możesz zapisywać tylko swoje własne zgłoszenia obecności.")

        invited_ids = set(rehearsal.invited_participations.values_list('id', flat=True))
        if invited_ids and participation.id not in invited_ids:
            raise PermissionDenied("Nie możesz zgłosić obecności dla próby, na którą nie zostałeś wezwany.")

    def perform_create(self, serializer):
        """Prevents users from creating attendance rows outside their own rehearsal scope."""
        self._validate_attendance_write(serializer)
        serializer.save()
        
    def perform_update(self, serializer):
        """Prevents users from editing attendance statuses outside their own rehearsal scope."""
        self._validate_attendance_write(serializer)
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
        """Cascade deletes micro-casting assignments when a piece is removed from a program."""
        ProjectPieceCasting.objects.filter(
            piece=instance.piece,
            participation__project=instance.project
        ).delete() 
        instance.delete()
    

class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    """Manages micro-casting (Divisi assignments) for specific pieces."""
    queryset = ProjectPieceCasting.objects.all()
    serializer_class = ProjectPieceCastingSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'participation__project', 'participation']

    def perform_destroy(self, instance):
        """
        Enforces deletion using Django's standard ORM.
        Avoids _raw_delete to ensure database integrity and triggers are respected.
        """
        instance.delete()

class CollaboratorViewSet(viewsets.ModelViewSet):
    """Manages external production staff profiles."""
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class CrewAssignmentViewSet(viewsets.ModelViewSet):
    """Manages assignments and contracts for external production staff."""
    queryset = CrewAssignment.objects.all()
    serializer_class = CrewAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'collaborator'] 

    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None) -> FileResponse:
        """Compiles a dynamic legal PDF artifact for crew members."""
        assignment = self.get_object()
        collaborator = assignment.collaborator
        project = assignment.project

        context = {
            'artist_name': f"{collaborator.first_name} {collaborator.last_name}",
            'role_description': assignment.role_description or collaborator.get_specialty_display(),
            'project_title': project.title,
            'project_date': project.date_time,
            'project_location': project.location or 'Miejsce do ustalenia',
            'fee': assignment.fee or 0,
            'generation_date': timezone.now(),
        }

        html_string = render_to_string('contracts/contract_pdf.html', context)
        pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        safe_last_name = collaborator.last_name.replace(' ', '_')
        filename = f"HR-{project.id}-CREW-{safe_last_name}.pdf"
        
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


@api_view(['GET'])
def get_voice_lines(request) -> Response:
    """Yields standardized vocal line taxonomies (e.g., Soprano, Tenor, Bass)."""
    choices = [{"value": choice[0], "label": str(choice[1])} for choice in VoiceLine.choices]
    return Response(choices)


@api_view(['GET'])
def get_voice_types(request) -> Response:
    """Yields top-level vocal type classifications for primary artist profiling."""
    choices = [{"value": choice[0], "label": str(choice[1])} for choice in VoiceType.choices]
    return Response(choices)
