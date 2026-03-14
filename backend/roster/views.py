# roster/views.py
# ==========================================
# Roster API ViewSets (Controllers)
# ==========================================
"""
REST API Views (Controllers) for the Roster application.
Author: Krystian Bugalski

Handles CRUD operations, role-based data isolation (QuerySet filtering),
and asynchronous task orchestration for binary file generation via Celery.
"""

import io
import weasyprint
from django.utils import timezone
from django.http import FileResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from celery.result import AsyncResult

from .models import Artist, Project, Participation, ProgramItem, Rehearsal, Attendance
from .serializers import (
    ArtistSerializer, ProgramItemSerializer, ProjectSerializer, 
    ParticipationSerializer, RehearsalSerializer, AttendanceSerializer
)
from .tasks import generate_project_zip_task

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission class:
    Allows read-only access to regular authenticated artists.
    Restricts data mutation (POST, PUT, DELETE) to administrative staff.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_superuser


class ArtistViewSet(viewsets.ModelViewSet):
    serializer_class = ArtistSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """
        Role-based Data Isolation:
        Admins access the full roster. Artists can only access their own profile.
        """
        user = self.request.user
        if user.is_superuser:
            return Artist.objects.all()
        return Artist.objects.filter(user=user)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Custom endpoint returning the profile of the currently authenticated user."""
        artist = get_object_or_404(Artist, user=request.user)
        serializer = self.get_serializer(artist)
        return Response(serializer.data)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """
        Optimizes database queries with prefetch_related to avoid N+1 issues
        when serializing nested casts and setlists.
        """
        user = self.request.user
        base_qs = Project.objects.prefetch_related(
            'participations__artist', 
            'program_items__piece'
        )
        
        if user.is_superuser:
            return base_qs.all()
        return base_qs.filter(participations__artist__user=user).distinct()


class ParticipationViewSet(viewsets.ModelViewSet):
    serializer_class = ParticipationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """Applies database optimizations (select_related) to prevent N+1 queries."""
        user = self.request.user
        base_queryset = Participation.objects.select_related('artist', 'project')
        if user.is_superuser:
            return base_queryset.all()
        return base_queryset.filter(artist__user=user)
    
    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None):
        """
        Generates a dynamic PDF contract for a single participant on-the-fly.
        Rendered securely in RAM (BytesIO) to avoid disk I/O bottlenecks.
        """
        participation = self.get_object()
        html_string = render_to_string('roster/contract_pdf.html', {'participation': participation})
        pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        safe_last_name = participation.artist.last_name.replace(' ', '_')
        filename = f"HR-{participation.project.id}-UOG-SUB-{safe_last_name}.pdf"
        
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['post'])
    def request_project_zip(self, request):
        """
        Triggers an asynchronous Celery task to generate bulk PDF contracts.
        Returns HTTP 202 Accepted with a task identifier for client polling.
        """
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "Missing project_id"}, status=status.HTTP_400_BAD_REQUEST)

        task = generate_project_zip_task.delay(project_id)
        return Response({"task_id": task.id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'])
    def check_zip_status(self, request):
        """
        Polling endpoint for the frontend to check the status of a Celery task.
        Returns the file download URL upon successful task completion.
        """
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
        Updates the contractual fee for all participants of a specific project 
        using a single, highly-optimized SQL UPDATE query.
        """
        project_id = request.data.get('project_id')
        fee = request.data.get('fee')

        if not project_id or fee is None:
            return Response(
                {"detail": "Missing project_id or fee."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Explicitly updating 'updated_at' since .update() bypasses the model's save() method
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
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    def get_queryset(self):
        return Attendance.objects.all()
    
class ProgramItemViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    
    def get_queryset(self):
        qs = ProgramItem.objects.select_related('piece').all().order_by('order')
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs