"""
REST API Views (Controllers) for the Archive application.
Author: Krystian Bugalski

Defines the endpoints for retrieving and modifying the repertoire data.
Implements custom permission logic to ensure only administrators can modify the archive.
"""

from rest_framework import viewsets, permissions
from .models import Composer, Piece, Track
from .serializers import ComposerSerializer, PieceSerializer, TrackSerializer

__author__ = "Krystian Bugalski"

# --- CUSTOM PERMISSION CLASS ---
class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission rule:
    - Read (GET, HEAD, OPTIONS) is allowed for any authenticated user.
    - Write (POST, PUT, PATCH, DELETE) is restricted to superusers (administrators) only.
    """
    def has_permission(self, request, view):
        # Allow read-only access for safe HTTP methods
        if request.method in permissions.SAFE_METHODS:
            return True
        # Require superuser privileges for destructive/modifying methods
        return request.user and request.user.is_superuser

# --- API VIEWSETS ---
class ComposerViewSet(viewsets.ModelViewSet):
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

class PieceViewSet(viewsets.ModelViewSet):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.all()
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]