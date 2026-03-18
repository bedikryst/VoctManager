# archive/views.py
# ==========================================
# Archive API ViewSets (Controllers)
# ==========================================
"""
REST API Views (Controllers) for the Archive application.
@author Krystian Bugalski

Defines the endpoints for retrieving and modifying the repertoire data.
Implements custom permission logic to ensure only administrators can modify the archive,
while regular artists have read-only access.
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Composer, Piece, Track, PieceVoiceRequirement
from .serializers import ComposerSerializer, PieceSerializer, TrackSerializer, PieceVoiceRequirementSerializer

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission class:
    Allows read-only access to authenticated artists.
    Restricts data mutation (POST, PUT, DELETE) to administrative staff.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_superuser


class ComposerViewSet(viewsets.ModelViewSet):
    """ViewSet for managing composers and arrangers."""
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class PieceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing musical pieces.
    Implements query optimizations (select_related, prefetch_related) 
    to handle nested composer and track data efficiently and prevent N+1 issues.
    """
    queryset = Piece.objects.select_related('composer').prefetch_related('tracks').all()
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class TrackViewSet(viewsets.ModelViewSet):
    """ViewSet for managing isolated rehearsal audio tracks."""
    queryset = Track.objects.select_related('piece').all()
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class PieceVoiceRequirementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing vocal line requirements per piece.
    ENTERPRISE FIX: Implements Hard Deletion bypass to prevent UniqueConstraint
    collisions caused by SoftDelete mechanisms when re-assigning deleted voice lines.
    """
    queryset = PieceVoiceRequirement.objects.all()
    serializer_class = PieceVoiceRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def perform_destroy(self, instance):
        """
        Executes a raw SQL DELETE, bypassing the EnterpriseBaseModel soft-delete mechanics.
        Essential for junction/configuration tables to maintain strict data integrity.
        """
        instance.__class__._base_manager.filter(pk=instance.pk)._raw_delete(instance._state.db)