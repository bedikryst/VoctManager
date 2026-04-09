# archive/views.py
# ==========================================
# Archive API ViewSets (Controllers)
# ==========================================
"""
REST API ViewSets for the Archive application.
@architecture Enterprise SaaS 2026

Delegates all business logic and state mutations to the Service Layer.
Relies on the global exception handler (RFC 7807) to process domain rule violations.
"""

import json
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from .models import Composer, Piece, Track, PieceVoiceRequirement
from .serializers import ComposerSerializer, PieceSerializer, TrackSerializer, PieceVoiceRequirementSerializer
from .dtos import PieceWriteDTO, VoiceRequirementDTO
from . import services


class IsAdminOrReadOnly(permissions.BasePermission):
    """Custom permission to allow read-only access to all authenticated users, but restrict writes to admins."""
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS: 
            return True
        return bool(request.user and request.user.is_superuser)


class ComposerViewSet(viewsets.ModelViewSet):
    """Endpoint for managing musical composers and arrangers."""
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class PieceViewSet(viewsets.ModelViewSet):
    """Core endpoint for managing the musical repertoire."""
    queryset = Piece.objects.select_related('composer').prefetch_related('tracks', 'voice_requirements').all()
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        dto = serializer.to_dto()
        sheet_music = serializer.validated_data.get('sheet_music')
        
        piece = services.create_piece(dto=dto, sheet_music_file=sheet_music)
        return Response(self.get_serializer(piece).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs) -> Response:
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        dto = serializer.to_dto(instance=instance)
        
        # Only pass update_sheet_music if it was actually included in the payload
        update_sheet_music = 'sheet_music' in serializer.validated_data
        sheet_music = serializer.validated_data.get('sheet_music')

        piece = services.update_piece(
            piece=instance, 
            dto=dto, 
            sheet_music_file=sheet_music, 
            update_sheet_music=update_sheet_music
        )

        return Response(self.get_serializer(piece).data)


class TrackViewSet(viewsets.ModelViewSet):
    """Endpoint for managing individual rehearsal audio tracks."""
    queryset = Track.objects.select_related('piece').all()
    serializer_class = TrackSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'voice_part']
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class PieceVoiceRequirementViewSet(viewsets.ModelViewSet):
    """Endpoint for managing vocal arrangement requirements (divisi) per piece."""
    queryset = PieceVoiceRequirement.objects.all()
    serializer_class = PieceVoiceRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]