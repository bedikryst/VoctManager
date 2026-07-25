# notifications/admin.py
from django.contrib import admin

from .models import Notification, PendingAnnouncement


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


@admin.register(PendingAnnouncement)
class PendingAnnouncementAdmin(admin.ModelAdmin):
    """
    Read-only window on a project's unsent announcements. Publishing and
    discarding belong to the conductor's own surface, where the queue is shown
    collapsed and with its recipients resolved — deciding row by row here would
    bypass both.
    """
    list_display = ('project', 'subject_type', 'kind', 'notification_type', 'level', 'recipient', 'published_at', 'created_at')
    list_filter = ('subject_type', 'kind', 'level', 'published_at', 'is_deleted')
    search_fields = ('project__title', 'recipient__email', 'change_field')
    readonly_fields = tuple(
        field.name for field in PendingAnnouncement._meta.fields
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False