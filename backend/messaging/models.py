"""
@file models.py
@description Durable conversation store for asynchronous, two-way communication
             between a single artist and the management pool. Deliberately NOT
             real-time: no presence, no typing state. Delivery (in-app/email/push)
             is delegated to the notifications pipeline — this app owns only the
             persistent thread + message records.
@architecture Enterprise SaaS 2026
@module messaging/models
"""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel


class ThreadContextType(models.TextChoices):
    """Optional anchoring of a conversation to a domain object."""
    GENERAL = 'GENERAL', _('General')
    PROJECT = 'PROJECT', _('Project')


class ThreadStatus(models.TextChoices):
    """Lifecycle state of a conversation, driven by management triage."""
    OPEN = 'OPEN', _('Open')
    RESOLVED = 'RESOLVED', _('Resolved')
    ARCHIVED = 'ARCHIVED', _('Archived')


class Thread(EnterpriseBaseModel):
    """
    A private conversation between one artist and one manager.

    ``assignee`` is the owning manager and gates visibility: a directed or
    claimed thread is visible only to the artist and its assignee. An unassigned
    thread sits in the shared intake queue, visible to every manager until one
    claims it (by replying or explicitly taking it over).
    """
    artist = models.ForeignKey(
        'roster.Artist',
        on_delete=models.PROTECT,
        related_name='threads',
        db_index=True,
        help_text=_("The single non-management party of the conversation."),
    )
    subject = models.CharField(
        max_length=160,
        help_text=_("Short headline summarizing the conversation."),
    )
    context_type = models.CharField(
        max_length=20,
        choices=ThreadContextType.choices,
        default=ThreadContextType.GENERAL,
        help_text=_("Optional domain anchor (e.g. a specific project)."),
    )
    context_id = models.UUIDField(
        null=True,
        blank=True,
        help_text=_("Loose reference to the anchored object (e.g. project_id). No hard FK by design."),
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_threads',
        help_text=_("Owning manager. Gates visibility: null = shared intake queue; set = private to this manager."),
    )
    status = models.CharField(
        max_length=20,
        choices=ThreadStatus.choices,
        default=ThreadStatus.OPEN,
        db_index=True,
        help_text=_("Triage state of the conversation."),
    )
    last_message_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text=_("Denormalized timestamp of the latest message for inbox sorting."),
    )

    class Meta:
        db_table = 'messaging_thread'
        ordering = ['-last_message_at']
        verbose_name = _('Thread')
        verbose_name_plural = _('Threads')
        indexes = [
            models.Index(fields=['artist', '-last_message_at']),
            models.Index(fields=['assignee', 'status']),
        ]

    def __str__(self) -> str:
        return f"Thread[{self.status}] {self.subject} — {self.artist_id}"


class Message(EnterpriseBaseModel):
    """A single utterance within a thread."""
    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True,
        help_text=_("Owning conversation."),
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_messages',
        help_text=_("Author. SET_NULL preserves the message if the account is purged (GDPR)."),
    )
    body = models.TextField(
        help_text=_("Message content. Length is validated at the DTO boundary."),
    )

    class Meta:
        db_table = 'messaging_message'
        ordering = ['created_at']
        verbose_name = _('Message')
        verbose_name_plural = _('Messages')
        indexes = [
            models.Index(fields=['thread', 'created_at']),
        ]

    def __str__(self) -> str:
        return f"Message in {self.thread_id} by {self.sender_id}"


class ThreadReadState(EnterpriseBaseModel):
    """
    Per-(thread, user) read pointer. A thread is unread for a user when
    ``thread.last_message_at > last_read_at`` (or no row exists at all).
    """
    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name='read_states',
        help_text=_("Conversation this pointer belongs to."),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='thread_read_states',
        help_text=_("Viewer the pointer tracks."),
    )
    last_read_at = models.DateTimeField(
        help_text=_("Timestamp up to which the viewer has read this thread."),
    )

    class Meta:
        db_table = 'messaging_thread_read_state'
        verbose_name = _('Thread Read State')
        verbose_name_plural = _('Thread Read States')
        constraints = [
            models.UniqueConstraint(
                fields=['thread', 'user'],
                condition=models.Q(is_deleted=False),
                name='unique_active_thread_read_state',
            )
        ]
        indexes = [
            models.Index(fields=['user', 'thread']),
        ]

    def __str__(self) -> str:
        return f"ReadState {self.thread_id} / {self.user_id} @ {self.last_read_at:%Y-%m-%d %H:%M}"


# =============================================================================
# Project channels — group conversation per project (many participants + management)
# =============================================================================


class ChannelRole(models.TextChoices):
    """Role of a member within a project channel."""
    MEMBER = 'MEMBER', _('Member')
    MANAGER = 'MANAGER', _('Manager')


class ProjectChannel(EnterpriseBaseModel):
    """
    One group channel per project. Membership is auto-synced from confirmed
    Participation; management has implicit access. Unlike Thread (1:1, directed),
    everyone in the channel reads and writes; delivery is in-app + opt-in push
    only (no per-message email/bell) to avoid flooding large casts.
    """
    project = models.OneToOneField(
        'roster.Project',
        on_delete=models.CASCADE,
        related_name='channel',
        help_text=_("The project this channel belongs to."),
    )
    last_message_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text=_("Timestamp of the latest message; null until the first message. Drives sorting + unread."),
    )

    class Meta:
        db_table = 'messaging_project_channel'
        ordering = ['-last_message_at']
        verbose_name = _('Project Channel')
        verbose_name_plural = _('Project Channels')

    def __str__(self) -> str:
        return f"Channel for project {self.project_id}"


class ChannelMembership(EnterpriseBaseModel):
    """
    A user's membership in a project channel. MEMBER rows are synced from
    confirmed Participation; MANAGER rows are created lazily on first access
    (managers always have access regardless). Carries per-user read pointer and
    push opt-in.
    """
    channel = models.ForeignKey(
        ProjectChannel,
        on_delete=models.CASCADE,
        related_name='memberships',
        help_text=_("The channel this membership grants access to."),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='channel_memberships',
        help_text=_("The member."),
    )
    role = models.CharField(
        max_length=20,
        choices=ChannelRole.choices,
        default=ChannelRole.MEMBER,
        help_text=_("MEMBER (synced from participation) or MANAGER."),
    )
    last_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("Timestamp up to which this member has read the channel."),
    )
    push_enabled = models.BooleanField(
        default=False,
        help_text=_("Per-channel opt-in for push notifications (off by default to avoid noise)."),
    )

    class Meta:
        db_table = 'messaging_channel_membership'
        verbose_name = _('Channel Membership')
        verbose_name_plural = _('Channel Memberships')
        constraints = [
            models.UniqueConstraint(
                fields=['channel', 'user'],
                condition=models.Q(is_deleted=False),
                name='unique_active_channel_membership',
            )
        ]
        indexes = [
            models.Index(fields=['user', 'channel']),
        ]

    def __str__(self) -> str:
        return f"Membership {self.channel_id} / {self.user_id} [{self.role}]"


class ChannelMessage(EnterpriseBaseModel):
    """A single message within a project channel."""
    channel = models.ForeignKey(
        ProjectChannel,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True,
        help_text=_("Owning channel."),
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_channel_messages',
        help_text=_("Author. SET_NULL preserves the message if the account is purged."),
    )
    body = models.TextField(help_text=_("Message content."))
    is_pinned = models.BooleanField(
        default=False,
        db_index=True,
        help_text=_("Pinned announcements surface at the top of the channel."),
    )

    class Meta:
        db_table = 'messaging_channel_message'
        ordering = ['created_at']
        verbose_name = _('Channel Message')
        verbose_name_plural = _('Channel Messages')
        indexes = [
            models.Index(fields=['channel', 'created_at']),
        ]

    def __str__(self) -> str:
        return f"ChannelMessage in {self.channel_id} by {self.sender_id}"
