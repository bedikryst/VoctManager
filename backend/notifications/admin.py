# notifications/admin.py
from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """
    Strictly read-only admin interface for system debugging.
    Notifications should be immutable once dispatched to prevent audit discrepancies.
    """
    list_display = ('recipient', 'notification_type', 'level', 'is_read', 'created_at')
    list_filter = ('level', 'is_read', 'notification_type', 'created_at')
    search_fields = ('recipient__email', 'recipient__first_name', 'recipient__last_name')
    readonly_fields = ('recipient', 'notification_type', 'level', 'is_read', 'read_at', 'metadata', 'created_at', 'updated_at', 'is_deleted')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        """Allow soft-deletes by superusers only if absolutely necessary for GDPR."""
        return request.user.is_superuser