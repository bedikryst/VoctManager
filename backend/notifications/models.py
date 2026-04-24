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
    # ---  CREW_ASSIGNED = 'CREW_ASSIGNED', _('Assigned to Crew Role')
    CONTRACT_ISSUED = 'CONTRACT_ISSUED', _('Contract Ready for Review')

    # --- ATTENDANCE & HR ---
    ABSENCE_REQUESTED = 'ABSENCE_REQUESTED', _('Absence Requested by Artist')
    ABSENCE_APPROVED = 'ABSENCE_APPROVED', _('Absence Request Approved')
    ABSENCE_REJECTED = 'ABSENCE_REJECTED', _('Absence Request Rejected')

    # --- SYSTEM ---
    SYSTEM_ALERT = 'SYSTEM_ALERT', _('System Maintenance or Alert')

    # --- MANAGER ALERTS ---
    PARTICIPATION_RESPONSE = 'PARTICIPATION_RESPONSE', _('Artist Project Response')
    ATTENDANCE_SUBMITTED = 'ATTENDANCE_SUBMITTED', _('Artist Attendance Info')

class Notification(EnterpriseBaseModel):
    """
    Enterprise notification model for user-specific alerts.
    """
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # Here CASCADE is acceptable ONLY because if the Core User is hard-deleted (GDPR purge), 
        # wiping their personal notifications directly via SQL is required by law.
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
    

class DeviceType(models.TextChoices):
    """
    Categorization of push target platforms for payload optimization.
    """
    WEB = 'WEB', _('Web Browser')
    IOS = 'IOS', _('Apple iOS')
    ANDROID = 'ANDROID', _('Google Android')


class PushDevice(EnterpriseBaseModel):
    """
    Enterprise registry of user devices authorized to receive Push notifications.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_devices',
        db_index=True,
        help_text=_("The user entity owning this device.")
    )
    registration_token = models.TextField(
        unique=True,
        help_text=_("The FCM or APNs device token provided by the client infrastructure.")
    )
    device_type = models.CharField(
        max_length=10,
        choices=DeviceType.choices,
        default=DeviceType.WEB,
        help_text=_("Hardware/Software platform of the registered device.")
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text=_("Indicates whether the token is currently valid. Invalidated automatically by delivery failures.")
    )

    class Meta:
        db_table = 'notifications_push_device'
        verbose_name = _('Push Device')
        verbose_name_plural = _('Push Devices')
        indexes = [
            models.Index(fields=['user', 'is_active']),
        ]

    def __str__(self) -> str:
        return f"Device [{self.device_type}] for {self.user.email}"


class NotificationPreference(EnterpriseBaseModel):
    """
    Granular user preferences mapping business events to delivery channels.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
        db_index=True,
        help_text=_("The user defining these preferences.")
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        help_text=_("The specific business event category this preference applies to.")
    )
    email_enabled = models.BooleanField(
        default=True,
        help_text=_("Delivery authorization for Email channel.")
    )
    push_enabled = models.BooleanField(
        default=True,
        help_text=_("Delivery authorization for Push channel.")
    )
    sms_enabled = models.BooleanField(
        default=False,
        help_text=_("Delivery authorization for SMS channel.")
    )

    class Meta:
        db_table = 'notifications_preference'
        verbose_name = _('Notification Preference')
        verbose_name_plural = _('Notification Preferences')
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'notification_type'],
                condition=models.Q(is_deleted=False),
                name='unique_active_user_preference_per_type'
            )
        ]

    def __str__(self) -> str:
        return f"Preferences [{self.notification_type}] for {self.user.email}"