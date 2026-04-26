# core/permissions.py
# ==========================================
# Enterprise RBAC Permissions
# Standard: Enterprise SaaS 2026
# ==========================================
from rest_framework import permissions
from django.db import models


class BaseEnterprisePermission(permissions.BasePermission):
    """
    Abstract base permission class providing resilient user profile resolution.
    Prevents AttributeError when handling unauthenticated requests or broken relations.
    """

    def _get_profile(self, request) -> models.Model | None:
        if not request.user or not request.user.is_authenticated:
            return None
        return getattr(request.user, 'profile', None)

    def _is_manager(self, request) -> bool:
        """Returns True for staff users and users with the manager profile role."""
        if request.user and request.user.is_authenticated and request.user.is_staff:
            return True
        profile = self._get_profile(request)
        return bool(profile and profile.is_manager)


# --- Role-Based Permissions ---

class IsManager(BaseEnterprisePermission):
    """
    Grants access exclusively to users with the MANAGER role or Django staff flag.
    """
    def has_permission(self, request, view) -> bool:
        return self._is_manager(request)


class IsArtist(BaseEnterprisePermission):
    """
    Grants access exclusively to users with the ARTIST role.
    """
    def has_permission(self, request, view) -> bool:
        profile = self._get_profile(request)
        return bool(profile and profile.is_artist)


class IsCrew(BaseEnterprisePermission):
    """
    Grants access exclusively to users with the CREW role.
    """
    def has_permission(self, request, view) -> bool:
        profile = self._get_profile(request)
        return bool(profile and profile.is_crew)


# --- Hybrid Role & Action Permissions ---

class IsManagerOrReadOnly(BaseEnterprisePermission):
    """
    Grants read-only access (GET, HEAD, OPTIONS) to any authenticated user.
    Restricts write operations (POST, PUT, PATCH, DELETE) to Managers and staff.
    """
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return self._is_manager(request)


class IsManagerOrCrew(BaseEnterprisePermission):
    """
    Grants access to both Managers and Crew members.
    Typically used for logistical endpoints (e.g., viewing technical riders).
    """
    def has_permission(self, request, view) -> bool:
        profile = self._get_profile(request)
        return bool(profile and (profile.is_manager or profile.is_crew))


# --- Object-Level Permissions (OLP) ---

class IsOwnerOrManager(BaseEnterprisePermission):
    """
    Grants full object access to the object's owner or any Manager.
    Requires the view's model to have a 'user' or 'profile' reference.
    """
    def has_object_permission(self, request, view, obj) -> bool:
        profile = self._get_profile(request)
        if not profile:
            return False
            
        # Manager override: unconditional access
        if profile.is_manager:
            return True
            
        # Resolve object ownership based on standard foreign key names
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'profile'):
            return obj.profile == profile
            
        return False


class IsOwnerOrReadOnly(BaseEnterprisePermission):
    """
    Grants read-only access to all authenticated users.
    Write operations are restricted exclusively to the object's owner.
    """
    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
            
        profile = self._get_profile(request)
        if not profile:
            return False

        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'profile'):
            return obj.profile == profile
            
        return False