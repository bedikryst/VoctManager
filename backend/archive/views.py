# archive/views.py
# ==========================================
# Archive API ViewSets (Controllers)
# ==========================================
"""
REST API Views (Controllers) for the Archive application.
Author: Krystian Bugalski

Defines the endpoints for retrieving and modifying the repertoire data.
Implements custom permission logic to ensure only administrators can modify the archive,
while regular artists have read-only access.
"""

from rest_framework import viewsets, permissions
from .models import Composer, Piece, Track
from .serializers import ComposerSerializer, PieceSerializer, TrackSerializer

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
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class PieceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing musical pieces.
    Implements query optimizations (select_related, prefetch_related) 
    to handle nested composer and track data efficiently.
    """
    queryset = Piece.objects.select_related('composer').prefetch_related('tracks').all()
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.select_related('piece').all()
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]