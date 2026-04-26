# documents/views.py
# ==========================================
# Chorister Hub API Views
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
import magic
import os
from uuid import UUID

from django.http import FileResponse
from django.utils.text import slugify
from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.constants import AppRole
from core.permissions import IsManagerOrReadOnly
from .models import DocumentCategory, Document
from .serializers import (
    DocumentCategorySerializer,
    DocumentCategoryCreateSerializer,
    DocumentCategoryUpdateSerializer,
    DocumentUploadSerializer,
    DocumentSerializer,
)
from .dtos import DocumentCategoryCreateDTO, DocumentCategoryUpdateDTO, DocumentCreateDTO
from .services import (
    DocumentService,
    ArtistMetricsService,
    DocumentCategoryNotFoundError,
    DocumentNotFoundError,
)

logger = logging.getLogger(__name__)


class DocumentCategoryViewSet(viewsets.ViewSet):
    """
    Manages Knowledge Base document categories.
    GET is role-filtered but open to all authenticated users.
    CUD operations and document upload/delete require Manager role.
    """
    permission_classes = [IsManagerOrReadOnly]

    def list(self, request: Request) -> Response:
        is_mgr = request.user.is_staff or getattr(
            getattr(request.user, 'profile', None), 'is_manager', False
        )
        if is_mgr:
            categories = DocumentService.get_all_categories_for_manager()
        else:
            categories = DocumentService.get_artist_visible_categories()

        serializer = DocumentCategorySerializer(categories, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request: Request) -> Response:
        serializer = DocumentCategoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        slug_base = slugify(data['name'])
        slug = slug_base
        counter = 1
        while DocumentCategory.objects.filter(slug=slug).exists():
            slug = f"{slug_base}-{counter}"
            counter += 1

        dto = DocumentCategoryCreateDTO(
            name=data['name'],
            slug=slug,
            description=data.get('description', ''),
            icon_key=data['icon_key'],
            order=data.get('order', 0),
            allowed_roles=data['allowed_roles'],
        )
        category = DocumentService.create_category(dto)
        out = DocumentCategorySerializer(category, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: str = None) -> Response:
        serializer = DocumentCategoryUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dto = DocumentCategoryUpdateDTO(**serializer.validated_data)
        try:
            category = DocumentService.update_category(UUID(pk), dto)
        except DocumentCategoryNotFoundError:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        out = DocumentCategorySerializer(category, context={'request': request})
        return Response(out.data)

    def destroy(self, request: Request, pk: str = None) -> Response:
        try:
            DocumentService.delete_category(UUID(pk))
        except DocumentCategoryNotFoundError:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='documents')
    def upload_document(self, request: Request, pk: str = None) -> Response:
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        uploaded_file = data['file']
        chunk = uploaded_file.read(2048)
        uploaded_file.seek(0)
        detected_mime = magic.from_buffer(chunk, mime=True)
        dto = DocumentCreateDTO(
            category_id=UUID(pk),
            title=data['title'],
            description=data.get('description', ''),
            allowed_roles=data.get('allowed_roles', []),
            order=data.get('order', 0),
            uploaded_by_id=request.user.id,
        )

        try:
            document = DocumentService.create_document(
                dto=dto,
                file=uploaded_file,
                file_size_bytes=uploaded_file.size,
                mime_type=detected_mime,
            )
        except DocumentCategoryNotFoundError:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        out = DocumentSerializer(document, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'documents/(?P<doc_id>[^/.]+)')
    def delete_document(self, request: Request, pk: str = None, doc_id: str = None) -> Response:
        try:
            DocumentService.delete_document(UUID(doc_id))
        except DocumentNotFoundError:
            return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentDownloadView(views.APIView):
    """
    Authenticated, role-gated file download endpoint.
    Replaces direct MEDIA_URL access to enforce allowed_roles on every download.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: UUID) -> Response:
        try:
            document = Document.objects.select_related('category').get(
                id=pk, is_deleted=False
            )
        except Document.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_role = AppRole.MANAGER if (
            request.user.is_staff
            or getattr(getattr(request.user, 'profile', None), 'is_manager', False)
        ) else AppRole.ARTIST

        effective_roles = document.effective_roles
        if effective_roles and user_role != AppRole.MANAGER and user_role not in effective_roles:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            file_handle = document.file.open('rb')
        except (FileNotFoundError, OSError):
            return Response({'detail': 'File not found on storage.'}, status=status.HTTP_404_NOT_FOUND)

        filename = os.path.basename(document.file.name)
        response = FileResponse(
            file_handle,
            content_type=document.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ArtistMetricsAPIView(views.APIView):
    """
    Returns aggregated performance history for the currently authenticated artist.
    Returns zeroed metrics for users without a linked artist profile (e.g. pure managers).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        artist_profile = getattr(request.user, 'artist_profile', None)

        if artist_profile is None:
            return Response(ArtistMetricsService.get_empty_metrics().model_dump())

        metrics = ArtistMetricsService.get_metrics_for_artist(artist_profile.id)

        return Response(metrics.model_dump())
