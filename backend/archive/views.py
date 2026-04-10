"""
===============================================================================
Archive API ViewSets (Controllers)
===============================================================================
Domain: Archive
Description: 
    REST API boundary. Strictly enforces 'Thin Controller' architecture. 
    All complex business logic, aggregate validations, and state mutations 
    are delegated to the Domain Service Layer (services.py).

Standards: SaaS 2026, RFC 7807 (Global Exception Handling), Aggregate Roots.
===============================================================================
"""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from .models import Composer, Piece, Track, PieceVoiceRequirement
from .serializers import ComposerSerializer, PieceSerializer, TrackSerializer, PieceVoiceRequirementSerializer
from . import services


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Enterprise RBAC (Role-Based Access Control) policy.
    Allows read-only access to all authenticated artists, but explicitly 
    restricts state mutations (WRITE operations) to administrative users.
    """
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS: 
            return True
        return bool(request.user and request.user.is_superuser)


class ComposerViewSet(viewsets.ModelViewSet):
    """
    Endpoint for managing musical composers and arrangers.
    Note: Standard DRF mutations are acceptable here as Composer acts as a 
    simple dictionary/lookup entity without complex domain constraints.
    """
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class PieceViewSet(viewsets.ModelViewSet):
    """
    Core aggregate root endpoint for managing the musical repertoire.
    Strictly delegates all state mutations to ArchiveManagementService.
    """
    queryset = Piece.objects.select_related('composer').prefetch_related('tracks', 'voice_requirements').all()
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        dto = serializer.to_dto()
        sheet_music = serializer.validated_data.get('sheet_music')
        
        # 100% Logic delegation to Service Layer
        piece = services.ArchiveManagementService.create_piece(dto=dto, sheet_music_file=sheet_music)
        
        return Response(self.get_serializer(piece).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs) -> Response:
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        dto = serializer.to_dto(instance=instance)
        
        update_sheet_music = 'sheet_music' in serializer.validated_data
        sheet_music = serializer.validated_data.get('sheet_music')

        # 100% Logic delegation to Service Layer
        piece = services.ArchiveManagementService.update_piece(
            piece=instance, 
            dto=dto, 
            sheet_music_file=sheet_music, 
            update_sheet_music=update_sheet_music
        )

        return Response(self.get_serializer(piece).data)


class TrackViewSet(viewsets.ModelViewSet):
    """
    Endpoint for managing individual rehearsal audio tracks.
    """
    queryset = Track.objects.select_related('piece').all()
    serializer_class = TrackSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'voice_part']
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def create(self, request, *args, **kwargs) -> Response:
        """
        SECURITY BOUNDARY: 
        In a fully mature SaaS, this should delegate to TrackService.create_track().
        For now, we enforce standard DRF behavior explicitly to denote where 
        future business logic (e.g., MP3 compression/validation) must be injected.
        """
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs) -> Response:
        """Enforces update boundaries."""
        return super().update(request, *args, **kwargs)


class PieceVoiceRequirementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint for viewing vocal arrangement requirements (divisi) per piece.
    
    ARCHITECTURAL RULE (Aggregate Roots):
    Write operations are explicitly disabled here (`ReadOnlyModelViewSet`). 
    Voice requirements are strictly sub-entities of a 'Piece'. They must never 
    be mutated independently of their parent to prevent orphaned records and 
    domain state corruption. Mutate them via PieceViewSet (`PieceWriteDTO`).
    """
    queryset = PieceVoiceRequirement.objects.all()
    serializer_class = PieceVoiceRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]