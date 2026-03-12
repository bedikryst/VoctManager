"""
REST API Views (Controllers) for the Roster application.
Author: Krystian Bugalski

Handles CRUD operations for HR management, role-based data isolation (QuerySet filtering),
and advanced binary file generation (PDF rendering and ZIP archiving in memory).
"""

import io
import zipfile
import weasyprint
from django.http import FileResponse, HttpResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Artist, Project, Participation
from .serializers import ArtistSerializer, ProjectSerializer, ParticipationSerializer
from celery.result import AsyncResult
from .tasks import generate_project_zip_task
from rest_framework import status


__author__ = "Krystian Bugalski"


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission class:
    Allows read-only access to regular authenticated users,
    but restricts write/edit operations to superusers.
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
        Admins can see the entire roster. Regular artists can only fetch their own profile.
        """
        user = self.request.user
        if user.is_superuser:
            return Artist.objects.all()
        return Artist.objects.filter(user=user)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """
        Custom API Endpoint: Returns only the profile of the currently authenticated user.
        Solves the issue where admins fetching /api/artists/ received the full array.
        """
        artist = get_object_or_404(Artist, user=request.user)
        serializer = self.get_serializer(artist)
        return Response(serializer.data)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """
        Role-based Data Isolation:
        Artists only see projects (concerts) they are explicitly cast in.
        """
        user = self.request.user
        if user.is_superuser:
            return Project.objects.all()
        return Project.objects.filter(participations__artist__user=user).distinct()


class ParticipationViewSet(viewsets.ModelViewSet):
    serializer_class = ParticipationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """
        Role-based Data Isolation:
        Artists can only see their own contract details and assigned fees.
        """
        user = self.request.user
        if user.is_superuser:
            return Participation.objects.all()
        return Participation.objects.filter(artist__user=user)
    
    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None):
        """
        Custom API Endpoint: Generates a dynamic PDF contract for a single participant.
        Uses WeasyPrint to render HTML to PDF and serves it directly from RAM using io.BytesIO.
        """
        participation = self.get_object()
        
        # Render HTML template with context data
        html_string = render_to_string('roster/contract_pdf.html', {'participation': participation})
        pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
        
        # Load binary data into memory buffer
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        # Sanitize filename
        safe_last_name = participation.artist.last_name.replace(' ', '_')
        filename = f"HR-{participation.project.id}-UOG-SUB-{safe_last_name}.pdf"
        
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        
        # Expose Content-Disposition header so the React frontend can read the exact filename
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'

        return response

    @action(detail=False, methods=['post'])
    def request_project_zip(self, request):
        """
        Krok 1: Inicjuje asynchroniczne generowanie paczki ZIP.
        Zwraca task_id dla frontendu.
        """
        project_id = request.data.get('project_id') # Używamy POST dla akcji zlecających
        if not project_id:
            return Response({"error": "Brak parametru project_id"}, status=status.HTTP_400_BAD_REQUEST)

        # Wrzuć zadanie do kolejki Celery (metoda .delay() to robi)
        task = generate_project_zip_task.delay(project_id)
        
        return Response({
            "task_id": task.id,
            "status": "processing",
            "message": "Generowanie umów rozpoczęte w tle."
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'])
    def check_zip_status(self, request):
        """
        Krok 2: Endpoint dla Reacta do odpytywania o status zadania.
        """
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({"error": "Brak parametru task_id"}, status=status.HTTP_400_BAD_REQUEST)

        task_result = AsyncResult(task_id)
        
        if task_result.state == 'PENDING' or task_result.state == 'STARTED':
            return Response({"state": task_result.state, "status": "W trakcie przygotowywania..."})
        
        elif task_result.state == 'SUCCESS':
            # Zadanie skończone, wyciągamy URL zwrócony przez task w tasks.py
            result_data = task_result.result
            if "error" in result_data:
                return Response({"state": "FAILED", "error": result_data["error"]}, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({
                "state": "SUCCESS",
                "download_url": result_data.get("download_url")
            })
            
        elif task_result.state == 'FAILURE':
            return Response({"state": "FAILURE", "error": str(task_result.info)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({"state": task_result.state})