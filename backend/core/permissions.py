# core/permissions.py
# ==========================================
# Enterprise RBAC Permissions
# ==========================================
from rest_framework import permissions

class IsManager(permissions.BasePermission):
    """
    Only Manager users have access to this endpoint.
    """
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'profile') and 
            request.user.profile.is_manager
        )

class IsManagerOrReadOnly(permissions.BasePermission):
    """
    All authenticated users can read (GET, OPTIONS, HEAD).
    Only Manager can modify (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
            
        return bool(
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'profile') and 
            request.user.profile.is_manager
        )