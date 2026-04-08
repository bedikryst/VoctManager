"""
URL configuration for VoctManager API.
Author: Krystian Bugalski

This module defines the routing structure using Django Rest Framework's DefaultRouter.
It automatically maps viewsets to standard RESTful endpoints (GET, POST, PATCH, DELETE).
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from .auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView

from roster.views import ArtistViewSet, CollaboratorViewSet, CrewAssignmentViewSet, ProgramItemViewSet, ProjectViewSet, ParticipationViewSet, RehearsalViewSet, AttendanceViewSet, ProjectPieceCastingViewSet, get_voice_lines, get_voice_types
from archive.views import ComposerViewSet, PieceViewSet, TrackViewSet, PieceVoiceRequirementViewSet
from core.views import (
    CurrentUserRetrieveUpdateView, 
    ChangePasswordView, 
    ChangeEmailRequestView
)
__author__ = "Krystian Bugalski"

# Initialize the REST Framework Router
router = DefaultRouter()

# --- HR & Roster Management Endpoints ---
router.register(r'artists', ArtistViewSet, basename='artist')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'participations', ParticipationViewSet, basename='participation')
router.register(r'rehearsals', RehearsalViewSet, basename='rehearsal')
router.register(r'attendances', AttendanceViewSet, basename='attendance')
router.register(r'program-items', ProgramItemViewSet, basename='program-item')
router.register(r'piece-castings', ProjectPieceCastingViewSet, basename='piece-casting')
router.register(r'collaborators', CollaboratorViewSet, basename='collaborator')
router.register(r'crew-assignments', CrewAssignmentViewSet, basename='crew-assignment')

# --- Repertoire Archive Endpoints ---
router.register(r'composers', ComposerViewSet, basename='composer')
router.register(r'pieces', PieceViewSet, basename='piece')
router.register(r'tracks', TrackViewSet, basename='track')
router.register(r'piece-voice-requirements', PieceVoiceRequirementViewSet, basename='piece-voice-requirement')

urlpatterns = [
    # Django Admin Panel
    path('admin/', admin.site.urls),
    
    # Auto-generated REST API routes
    path('api/', include(router.urls)),

    # --- JWT Authentication Endpoints ---
    # Used by the React frontend to obtain and refresh access tokens
    path('api/token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', LogoutView.as_view(), name='logout'),

    # --- API Documentation Endpoints (Swagger & ReDoc) ---
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # --- Custom Endpoints for Frontend Options ---
    path('api/options/voice-lines/', get_voice_lines, name='options-voice-lines'),
    path('api/options/voice-types/', get_voice_types, name='options-voice-types'),

    # --- User Settings & Profile Endpoints ---
    path('api/users/me/', CurrentUserRetrieveUpdateView.as_view(), name='user-me'),
    path('api/users/me/change-password/', ChangePasswordView.as_view(), name='user-change-password'),
    path('api/users/me/change-email/', ChangeEmailRequestView.as_view(), name='user-change-email'),
]

# Serve user-uploaded media files (PDFs, Audio) via Django ONLY during local development.
# In production, this should be handled by Nginx or a cloud storage provider (e.g., AWS S3).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)