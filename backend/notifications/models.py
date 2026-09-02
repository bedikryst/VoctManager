# notifications/models.py
from django.conf import settings
from django.db import models
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
    # Everything one artist has not been told about one project, in one message:
    # the shared changes plus their own. Composed at publication from the queue,
    # never emitted directly by a write.
    PROJECT_BRIEFING = 'PROJECT_BRIEFING', _('Project Briefing')

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

    # --- PUBLIC SITE / COPY DESK ---
    # One editor's sitting at the copy desk, gathered into a single message once
    # they have stopped. Raised by the clock rather than by an edit, for the same
    # reason ANNOUNCEMENT_PENDING is: the desk has no "submit" button, so the
    # boundary of a sitting is a pause, and only a sweep can see a pause.
    SITE_COPY_PROPOSED = 'SITE_COPY_PROPOSED', _('Site Copy Proposed')

    # --- MANAGER ALERTS ---
    PARTICIPATION_RESPONSE = 'PARTICIPATION_RESPONSE', _('Artist Project Response')
    ATTENDANCE_SUBMITTED = 'ATTENDANCE_SUBMITTED', _('Artist Attendance Info')
    # The safety net under the announcement queue: a live project holding changes
    # the cast has not been told about. Manager-only, because it is a prompt to act
    # and only a manager may publish. Raised by the clock, never by an edit — so it
    # is the one project notification that does not pass through announcements.py.
    ANNOUNCEMENT_PENDING = 'ANNOUNCEMENT_PENDING', _('Unannounced Changes Waiting')

    # --- DIRECT MESSAGING ---
    CUSTOM_ADMIN_MESSAGE = 'CUSTOM_ADMIN_MESSAGE', _('Direct Message from Management')
    NOTIFICATION_READ_RECEIPT = 'NOTIFICATION_READ_RECEIPT', _('Message Read by Artist')
    MESSAGE_RECEIVED = 'MESSAGE_RECEIVED', _('New Message in Conversation')
    CHANNEL_MESSAGE = 'CHANNEL_MESSAGE', _('New Message in Project Channel')

class AnnouncementSubject(models.TextChoices):
    """What a queued announcement is *about*.

    Collapsing is per subject: two edits to the same rehearsal are one piece of
    news, an edit to the project and an edit to a rehearsal are two. The subject
    also decides who a broadcast reaches — a rehearsal announcement follows that
    rehearsal's invited set, a project announcement the whole cast.
    """
    PROJECT = 'PROJECT', _('Project')
    REHEARSAL = 'REHEARSAL', _('Rehearsal')
    CASTING = 'CASTING', _('Piece casting')
    # Someone's place in the cast. Unlike the other three this never folds into a
    # briefing: being taken off a project is a personal message, not a bullet in a
    # list of what is new about a concert the reader is no longer part of.
    PARTICIPATION = 'PARTICIPATION', _('Participation')


class AnnouncementKind(models.TextChoices):
    """The subject's lifecycle step, kept apart from the notification type so
    collapsing never has to know what each type means: a creation supersedes the
    edits that follow it, a removal supersedes everything, and a creation cancelled
    before publication leaves nothing to say."""
    CREATED = 'CREATED', _('Created')
    CHANGED = 'CHANGED', _('Changed')
    REMOVED = 'REMOVED', _('Removed')


class PendingAnnouncement(EnterpriseBaseModel):
    """One change to a live project, held back until the conductor publishes it.

    On an ACTIVE project persistence and announcement are separate acts: the write
    lands immediately (the database is the truth) and this row records what the
    cast would be told, so a typo corrected a minute later never reaches anyone.

    Rows are per *field*, not per save, which is what lets a value moved and moved
    back cancel out and what will let the review sheet exclude one line without
    dropping the rest. A row is consumed exactly once — `published_at` for one that
    was announced (or collapsed into silence), soft-deletion for one the conductor
    discarded.
    """
    project = models.ForeignKey(
        'roster.Project',
        on_delete=models.CASCADE,
        related_name='pending_announcements',
        db_index=True,
        help_text=_("The project whose queue this change belongs to.")
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pending_announcements',
        null=True,
        blank=True,
        db_index=True,
        help_text=_(
            "Who this change is personal to. NULL means a broadcast, whose "
            "audience is resolved from the live cast at publish time."
        )
    )
    subject_type = models.CharField(
        max_length=20,
        choices=AnnouncementSubject.choices,
        help_text=_("Which kind of thing changed.")
    )
    subject_id = models.CharField(
        max_length=64,
        help_text=_("Identity of the changed thing within its type (rehearsal, piece, project).")
    )
    kind = models.CharField(
        max_length=10,
        choices=AnnouncementKind.choices,
        help_text=_("Lifecycle step this row records.")
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        help_text=_("The type the published announcement will carry.")
    )
    level = models.CharField(
        max_length=20,
        choices=NotificationLevel.choices,
        default=NotificationLevel.INFO,
        help_text=_("Urgency of this row alone; a published announcement takes the loudest that survives collapsing.")
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text=_("The payload exactly as the emitting service built it, minus the diff (rebuilt at publish).")
    )
    change_field = models.CharField(
        max_length=50,
        blank=True,
        help_text=_("Stable change key for a field diff (e.g. 'date_time'). Empty on creations and removals.")
    )
    change_old = models.TextField(
        null=True,
        blank=True,
        help_text=_("Language-neutral display value before the change. NULL when unset or when the change is label-only.")
    )
    change_new = models.TextField(
        null=True,
        blank=True,
        help_text=_("Language-neutral display value after the change.")
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text=_("When this row was consumed by a publication. NULL = still pending.")
    )

    class Meta:
        db_table = 'notifications_pending_announcement'
        ordering = ['created_at']
        verbose_name = _('Pending Announcement')
        verbose_name_plural = _('Pending Announcements')
        indexes = [
            # The queue is always read per project, pending-only.
            models.Index(fields=['project', 'published_at', 'is_deleted']),
        ]

    @property
    def collapse_key(self) -> str:
        """What this row competes with. Derived rather than stored: the parts are
        already columns, and a denormalized copy would be one more thing to keep
        true."""
        return f"{self.subject_type.lower()}:{self.subject_id}:{self.change_field or self.kind.lower()}"

    def __str__(self) -> str:
        return f"[{self.kind}] {self.notification_type} on {self.subject_type} {self.subject_id}"


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
        help_text=_("The FCM/APNs device token (mobile) or Web Push endpoint URL (web).")
    )
    p256dh_key = models.TextField(
        null=True,
        blank=True,
        help_text=_("ECDH public key for Web Push payload encryption. WEB device type only.")
    )
    auth_key = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text=_("Auth secret for Web Push payload encryption. WEB device type only.")
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