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
import weasyprint
import csv
from django.utils import timezone
from django.http import FileResponse, HttpResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from celery.result import AsyncResult

from .models import Artist, CrewAssignment, Project, Participation, ProgramItem, Rehearsal, Attendance, VoiceType, ProjectPieceCasting, Collaborator
from .serializers import (
    ArtistSerializer, CollaboratorSerializer, CrewAssignmentSerializer, ProgramItemSerializer, ProjectSerializer, 
    ParticipationSerializer, RehearsalSerializer, AttendanceSerializer, ProjectPieceCastingSerializer
)
from .tasks import generate_project_zip_task
from core.constants import VoiceLine

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom Permission Architecture:
    Permits unrestricted read-only access (GET/OPTIONS) to authenticated personnel.
    Restricts state mutation operations (POST/PUT/PATCH/DELETE) strictly to administrators.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_superuser


class ArtistViewSet(viewsets.ModelViewSet):
    """Endpoint for managing Artist profiles and accounts."""
    serializer_class = ArtistSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """
        Role-based Data Isolation:
        Administrators access the full roster matrix. Base users are restricted to their own operational profile.
        """
        user = self.request.user
        if user.is_superuser:
            return Artist.objects.all()
        return Artist.objects.filter(user=user)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Custom endpoint returning the dedicated profile mapping of the active authenticated session."""
        artist = get_object_or_404(Artist, user=request.user)
        serializer = self.get_serializer(artist)
        return Response(serializer.data)


class ProjectViewSet(viewsets.ModelViewSet):
    """Centralized controller for lifecycle event management and reporting."""
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

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
    
    @action(detail=True, methods=['get'])
    def roster(self, request, pk=None):
        """
        Secure endpoint returning the project's cast roster.
        Strictly strips all financial and contractual data to protect confidentiality across the ensemble.
        """
        project = self.get_object()
        participations = Participation.objects.filter(project=project).select_related('artist')
        
        roster_data = []
        for p in participations:
            roster_data.append({
                "id": p.artist.id,
                "name": f"{p.artist.first_name} {p.artist.last_name}",
                "voice_type": p.artist.get_voice_type_display(),
            })
            
        return Response(roster_data)
    
    @action(detail=True, methods=['get'])
    def export_call_sheet(self, request, pk=None):
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

    @action(detail=True, methods=['get'])
    def export_zaiks(self, request, pk=None):
        """Compiles and streams a UTF-8 BOM formatted CSV payload for ZAiKS copyright reporting."""
        project = self.get_object()
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')

        response = HttpResponse(content_type='text/csv; charset=utf-8-sig') 
        response['Content-Disposition'] = f'attachment; filename="ZAiKS_{project.title.replace(" ", "_")}.csv"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'

        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Lp.', 'Tytuł Utworu', 'Kompozytor', 'Aranżer', 'Czas trwania', 'Uwagi (BIS)'])

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
            
            writer.writerow([idx, title, composer_name, arranger_name, '', encore])

        return response

    @action(detail=True, methods=['get'])
    def export_dtp(self, request, pk=None):
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
    """Endpoint for managing operational contracts between artists and projects."""
    serializer_class = ParticipationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        base_queryset = Participation.objects.select_related('artist', 'project')
        if user.is_superuser:
            return base_queryset.all()
        return base_queryset.filter(artist__user=user)
    
    def perform_destroy(self, instance):
        """
        ENTERPRISE FIX: Hard Delete Bypass cascade logic.
        Force-clears structural M2M relations and purges dependent relational entities 
        prior to base instance deletion. Required to prevent cascading UniqueConstraint violations.
        """
        instance.invited_rehearsals.clear()

        Attendance._base_manager.filter(participation=instance)._raw_delete(instance._state.db)
        ProjectPieceCasting._base_manager.filter(participation=instance)._raw_delete(instance._state.db)
        
        instance.__class__._base_manager.filter(pk=instance.pk)._raw_delete(instance._state.db)

    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None):
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

    @action(detail=False, methods=['post'])
    def request_project_zip(self, request):
        """
        Delegates bulk document generation processing to a Celery background worker.
        Returns a transactional tracking ID.
        """
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "Missing project_id"}, status=status.HTTP_400_BAD_REQUEST)

        task = generate_project_zip_task.delay(project_id)
        return Response({"task_id": task.id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'])
    def check_zip_status(self, request):
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
            
        else:
            return Response({"state": result.state})
        
    @action(detail=False, methods=['patch'], url_path='bulk-fee')
    def bulk_fee(self, request):
        """
        Executes a highly-optimized batch SQL UPDATE bypassing standard ORM iteration.
        """
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
    serializer_class = RehearsalSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    def get_queryset(self):
        return Rehearsal.objects.all()

class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Attendance.objects.all()
    
    def perform_destroy(self, instance):
        """Hard delete applied to bypass potential persistence ghost constraints."""
        instance.__class__._base_manager.filter(pk=instance.pk)._raw_delete(instance._state.db)
    
class ProgramItemViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    
    def get_queryset(self):
        qs = ProgramItem.objects.select_related('piece').all().order_by('order')
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs
    
    def perform_destroy(self, instance):
        """
        Hard deletion algorithm executing cascade clearance on structural pivot tables.
        """
        ProjectPieceCasting._base_manager.filter(
            piece=instance.piece,
            participation__project=instance.project
        )._raw_delete(instance._state.db)
        
        instance.__class__._base_manager.filter(pk=instance.pk)._raw_delete(instance._state.db)
    

class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    queryset = ProjectPieceCasting.objects.all()
    serializer_class = ProjectPieceCastingSerializer
    filterset_fields = ['piece', 'participation__project', 'participation']

    def perform_destroy(self, instance):
        """Enforces physical row deletion for micro-casting junction configurations."""
        instance.__class__._base_manager.filter(pk=instance.pk)._raw_delete(instance._state.db)
        

class CollaboratorViewSet(viewsets.ModelViewSet):
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer

class CrewAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CrewAssignment.objects.all()
    serializer_class = CrewAssignmentSerializer
    filterset_fields = ['project', 'collaborator'] 

    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None):
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
def get_voice_lines(request):
    """Yields standardized vocal line taxonomies (e.g., Soprano, Tenor, Bass)."""
    choices = [{"value": choice[0], "label": str(choice[1])} for choice in VoiceLine.choices]
    return Response(choices)

@api_view(['GET'])
def get_voice_types(request):
    """Yields top-level vocal type classifications for primary artist profiling."""
    choices = [{"value": choice[0], "label": str(choice[1])} for choice in VoiceType.choices]
    return Response(choices)