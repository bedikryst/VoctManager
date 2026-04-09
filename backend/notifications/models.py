# notifications/models.py
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from core.models import EnterpriseBaseModel

class NotificationLevel(models.TextChoices):
    """
    Defines the visual and intrusive priority of the notification.
    Allows the frontend to render different icons or colors (e.g., Red for URGENT).
    """
    INFO = 'INFO', _('Information')
    WARNING = 'WARNING', _('Warning')
    URGENT = 'URGENT', _('Urgent')

class NotificationType(models.TextChoices):
    """
    Exhaustive dictionary of business events across the VoctManager domain.
    Grouped logically for maintainability.
    """
    # --- PROJECT MANAGEMENT ---
    PROJECT_INVITATION = 'PROJECT_INVITATION', _('Project Invitation')
    PROJECT_UPDATED = 'PROJECT_UPDATED', _('Project Details Updated')
    PROJECT_CANCELLED = 'PROJECT_CANCELLED', _('Project Cancelled')
    PROJECT_REMINDER = 'PROJECT_REMINDER', _('Upcoming Project Reminder')

    # --- REHEARSALS & SCHEDULE ---
    REHEARSAL_SCHEDULED = 'REHEARSAL_SCHEDULED', _('New Rehearsal Scheduled')
    REHEARSAL_UPDATED = 'REHEARSAL_UPDATED', _('Rehearsal Time/Location Changed')
    REHEARSAL_CANCELLED = 'REHEARSAL_CANCELLED', _('Rehearsal Cancelled')
    REHEARSAL_REMINDER = 'REHEARSAL_REMINDER', _('Upcoming Rehearsal Reminder')

    # --- REPERTOIRE & CASTING ---
    PIECE_CASTING_ASSIGNED = 'PIECE_CASTING_ASSIGNED', _('Assigned to Piece')
    PIECE_CASTING_UPDATED = 'PIECE_CASTING_UPDATED', _('Piece Casting Changed')
    MATERIAL_UPLOADED = 'MATERIAL_UPLOADED', _('New Sheet Music or Audio Track')

    # --- LOGISTICS & HR ---
    CREW_ASSIGNED = 'CREW_ASSIGNED', _('Assigned to Crew Role')
    CONTRACT_ISSUED = 'CONTRACT_ISSUED', _('Contract Ready for Review')

    # --- ATTENDANCE & HR ---
    ABSENCE_REQUESTED = 'ABSENCE_REQUESTED', _('Absence Requested by Artist')
    ABSENCE_APPROVED = 'ABSENCE_APPROVED', _('Absence Request Approved')
    ABSENCE_REJECTED = 'ABSENCE_REJECTED', _('Absence Request Rejected')

    # --- SYSTEM ---
    SYSTEM_ALERT = 'SYSTEM_ALERT', _('System Maintenance or Alert')

class Notification(EnterpriseBaseModel):
    """
    Enterprise notification model for user-specific alerts.
    """
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True,
        help_text=_("The user receiving the notification.")
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        db_index=True,
        help_text=_("Categorization key for frontend routing and icon selection.")
    )
    level = models.CharField(
        max_length=20,
        choices=NotificationLevel.choices,
        default=NotificationLevel.INFO,
        help_text=_("Urgency level dictating frontend presentation.")
    )
    is_read = models.BooleanField(
        default=False,
        db_index=True,
        help_text=_("Indicates whether the recipient has viewed this notification.")
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("Timestamp of when the notification was marked as read.")
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text=_("Contextual payload. E.g., {'project_id': 'uuid', 'piece_title': 'Requiem', 'voice_type': 'Soprano 1'}.")
    )

    class Meta:
        db_table = 'notifications_notification'
        ordering = ['-created_at']
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')
        indexes = [
            # High-performance index for the "unread count" badge
            models.Index(fields=['recipient', 'is_read']),
            # Index for sorting/filtering user's inbox
            models.Index(fields=['recipient', '-created_at']), 
        ]

    def __str__(self) -> str:
        return f"[{self.level}] {self.notification_type} for {self.recipient.email}"