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

    @action(detail=False, methods=['get'])
    def project_zip(self, request):
        """
        Custom API Endpoint: Generates a ZIP archive containing PDF contracts 
        for all artists assigned to a specific project. Everything happens in RAM.
        """
        project_id = request.query_params.get('project_id')
        if not project_id:
            return HttpResponse("Missing project_id parameter", status=400)

        # Retrieve the cast for the specified project
        participations = self.get_queryset().filter(project_id=project_id)
        
        zip_buffer = io.BytesIO()
        
        # Create ZIP file in memory (ZIP_DEFLATED adds compression)
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for p in participations:
                # Generate individual PDF
                html_string = render_to_string('roster/contract_pdf.html', {'participation': p})
                pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
                
                safe_last_name = p.artist.last_name.replace(' ', '_')
                filename = f"HR-{p.project.id}-UOG-SUB-{safe_last_name}.pdf"
                
                # Write PDF binary directly into the ZIP archive
                zip_file.writestr(filename, pdf_bytes)
                
        zip_buffer.seek(0)
        
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="Umowy_Koncert_{project_id}.zip"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        
        return response