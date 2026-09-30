"""
@file services.py
@description Core messaging domain service. Owns thread/message persistence and
             — critically — translates each new message into a delivery signal by
             reusing the notifications pipeline (MESSAGE_RECEIVED). No transport
             logic lives here: NotificationService fans out to in-app/email/push.
             Also erases the copies of an author's words that delivery left in
             other people's inboxes, since it is what wrote them there.
@architecture Enterprise SaaS 2026
@module messaging/services
"""
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from core.permissions import MANAGER_QUERY_FILTER
from notifications.dtos import NotificationCreateDTO
from notifications.models import Notification, NotificationLevel, NotificationType
from notifications.services import NotificationService
from notifications.tasks import send_push_notification_task

from .dtos import ThreadCreateDTO
from .models import (
    ChannelMembership,
    ChannelMessage,
    ChannelRole,
    Message,
    ProjectChannel,
    Thread,
    ThreadReadState,
    ThreadStatus,
)
from .selectors import current_memberships, user_display_name

logger = logging.getLogger(__name__)
User = get_user_model()

_SNIPPET_LEN = 200

#: What an erased author's words are replaced with, in the conversation and in
#: every notification that carried a copy of them.
ERASED_BODY = "[treść usunięta]"


class MessagingService:
    """Orchestrates conversation lifecycle and downstream delivery signals."""

    # ------------------------------------------------------------------ #
    # Write paths                                                        #
    # ------------------------------------------------------------------ #

    @classmethod
    def create_thread(cls, dto: ThreadCreateDTO) -> Thread:
        """Opens a conversation with its first message and pings the other party."""
        with transaction.atomic():
            now = timezone.now()
            thread = Thread.objects.create(
                artist_id=dto.artist_id,
                subject=dto.subject,
                context_type=dto.context_type,
                context_id=dto.context_id,
                assignee_id=dto.assignee_id,
                last_message_at=now,
            )
            message = Message.objects.create(thread=thread, sender_id=dto.sender_id, body=dto.body)
            cls._touch_read_state(thread.id, dto.sender_id, when=now)
            transaction.on_commit(
                lambda: cls._emit_for_message(message.id, dto.sender_id)
            )
        logger.info("[MessagingService] Thread %s opened by UID:%s", thread.id, dto.sender_id)
        return thread

    @classmethod
    def post_message(
        cls, *, thread: Thread, sender_id: int, body: str, claim_if_unassigned: bool = False
    ) -> Message:
        """Appends a reply, bumps the inbox sort key, and pings the other party.

        A reply to a RESOLVED thread reopens it: "resolved" is a triage state ("handled"),
        not a lock — a fresh message means the conversation is live again.

        ``claim_if_unassigned`` (set when the sender is a manager): a manager replying to
        a thread still in the shared queue claims it, turning the conversation private to
        that manager and the artist.
        """
        with transaction.atomic():
            message = Message.objects.create(thread=thread, sender_id=sender_id, body=body)
            thread.last_message_at = message.created_at
            update_fields = ['last_message_at', 'updated_at']
            if thread.status == ThreadStatus.RESOLVED:
                thread.status = ThreadStatus.OPEN
                update_fields.append('status')
            if claim_if_unassigned and thread.assignee_id is None:
                thread.assignee_id = sender_id
                update_fields.append('assignee')
            thread.save(update_fields=update_fields)
            cls._touch_read_state(thread.id, sender_id, when=message.created_at)
            transaction.on_commit(
                lambda: cls._emit_for_message(message.id, sender_id)
            )
        logger.info("[MessagingService] Message %s posted to thread %s by UID:%s", message.id, thread.id, sender_id)
        return message

    @classmethod
    def mark_read(cls, *, thread: Thread, user_id: int) -> None:
        """Advances the viewer's read pointer to now."""
        cls._touch_read_state(thread.id, user_id, when=timezone.now())

    @staticmethod
    def _touch_read_state(thread_id: UUID, user_id: int, *, when: datetime) -> None:
        """Advances the reader's pointer, and reads the bell rows it covers.

        Reading or answering a conversation is reading its messages, so the bell
        must not count them again. Only rows written up to `when`: a message
        that arrives while the thread is open is still news until the next read.
        """
        ThreadReadState.objects.update_or_create(
            thread_id=thread_id,
            user_id=user_id,
            defaults={'last_read_at': when, 'is_deleted': False},
        )
        NotificationService.mark_resolved(
            NotificationType.MESSAGE_RECEIVED,
            recipient_id=user_id,
            created_before=when,
            thread_id=str(thread_id),
        )

    # ------------------------------------------------------------------ #
    # Delivery signal (reuses notifications pipeline)                    #
    # ------------------------------------------------------------------ #

    @classmethod
    def _emit_for_message(cls, message_id: UUID, sender_id: int) -> None:
        """Resolves recipients and provisions a MESSAGE_RECEIVED notification each."""
        try:
            message = Message.objects.select_related(
                'thread', 'thread__artist', 'thread__assignee', 'sender'
            ).get(id=message_id)
        except Message.DoesNotExist:
            logger.warning("[MessagingService] Emit aborted, message %s vanished.", message_id)
            return

        thread = message.thread
        recipient_ids = cls._resolve_recipients(thread, sender_id)
        if not recipient_ids:
            return

        metadata = cls._build_metadata(thread, message, sender_id)
        for uid in recipient_ids:
            dto = NotificationCreateDTO(
                recipient_id=str(uid),
                notification_type=NotificationType.MESSAGE_RECEIVED,
                level=NotificationLevel.INFO,
                metadata=metadata,
            )
            NotificationService.create_notification(dto)

    @staticmethod
    def _resolve_recipients(thread: Thread, sender_id: int) -> list[int]:
        """
        Artist's message → directed assignee, else the whole management pool.
        Manager's message → the single artist (if they have a linked account).
        The sender is always excluded.
        """
        artist_user_id = thread.artist.user_id

        if sender_id == artist_user_id:
            if thread.assignee_id:
                ids: list[int] = [thread.assignee_id]
            else:
                ids = list(
                    User.objects.filter(
                        MANAGER_QUERY_FILTER, is_active=True,
                    ).values_list('id', flat=True)
                )
        else:
            ids = [artist_user_id] if artist_user_id else []

        return [uid for uid in ids if uid and uid != sender_id]

    @staticmethod
    def _build_metadata(thread: Thread, message: Message, sender_id: int) -> dict[str, str]:
        """JSON-safe payload for the notification (and email template) — no localized
        strings baked in; the email template renders its own translated CTA label.

        It copies the author's words and name into the recipient's inbox, so
        ``sender_id`` travels with them: erasure finds the copies by it
        (`erase_notification_copies`)."""
        site_url = getattr(settings, 'SITE_URL', 'https://voctensemble.com/panel').rstrip('/')
        body = message.body or ''
        return {
            'thread_id': str(thread.id),
            'title': thread.subject,
            'sender_id': str(sender_id),
            'sender_name': user_display_name(message.sender),
            'message': body,
            'snippet': body[:_SNIPPET_LEN],
            'cta_url': f"{site_url}/messages/{thread.id}",
        }

    @staticmethod
    def erase_notification_copies(user: Any) -> int:
        """Blanks the copies of ``user``'s messages held in other people's inboxes.

        Rows written with ``sender_id`` are matched on it. Rows written before it
        existed carry no sender, so they are matched by the threads the user wrote
        in. Under `_resolve_recipients`, a row in the artist's own thread that is
        addressed to anyone else came from the artist; in a thread the user wrote
        in as a manager, the row may carry another manager's words, and blanking
        that copy too is the safe side of not knowing — the message itself stays
        in the conversation. A thread the user is the artist of is erased whole,
        so its subject goes as well. The user's own inbox is not touched.
        """
        own_threads = {
            str(thread_id)
            for thread_id in Thread.all_objects.filter(artist__user=user).values_list('id', flat=True)
        }
        written_in = {
            str(thread_id)
            for thread_id in Message.all_objects.filter(sender=user).values_list('thread_id', flat=True)
        }
        copies = (
            Notification.all_objects
            .filter(notification_type=NotificationType.MESSAGE_RECEIVED)
            .exclude(recipient=user)
            .filter(
                Q(metadata__sender_id=str(user.pk))
                | Q(
                    metadata__sender_id__isnull=True,
                    metadata__thread_id__in=sorted(own_threads | written_in),
                )
            )
        )
        erased = 0
        for notification in copies.only('id', 'metadata'):
            metadata = dict(notification.metadata)
            metadata.update(message=ERASED_BODY, snippet=ERASED_BODY, sender_name='')
            if metadata.get('thread_id') in own_threads:
                metadata['title'] = ERASED_BODY
            notification.metadata = metadata
            notification.save(update_fields=['metadata', 'updated_at'])
            erased += 1
        return erased


class ChannelService:
    """
    Orchestrates project group channels. Delivery is deliberately in-app + opt-in
    push only — no per-message email/bell — so a large cast isn't flooded.
    """

    @classmethod
    def get_or_create_for_project(cls, project) -> ProjectChannel:
        channel, _ = ProjectChannel.objects.get_or_create(project=project)
        return channel

    @classmethod
    def ensure_manager_membership(cls, *, channel: ProjectChannel, user) -> None:
        """Managers always have access; lazily create/reactivate their row (read-state + mute)."""
        ChannelMembership.all_objects.update_or_create(
            channel=channel,
            user=user,
            defaults={'role': ChannelRole.MANAGER, 'is_deleted': False},
        )

    @classmethod
    def post_message(
        cls, *, channel: ProjectChannel, sender_id: int, body: str, pinned: bool = False
    ) -> ChannelMessage:
        """Appends to the stream and pushes to the members who opted in.

        ``pinned`` publishes an announcement in the same write: a post followed by
        a separate pin could succeed halfway, and a retry of the half that looked
        failed would publish the announcement twice. Who may pin is the view's
        decision.
        """
        with transaction.atomic():
            message = ChannelMessage.objects.create(
                channel=channel, sender_id=sender_id, body=body, is_pinned=pinned
            )
            channel.last_message_at = message.created_at
            channel.save(update_fields=['last_message_at', 'updated_at'])
            cls._touch_read(channel.id, sender_id, when=message.created_at)
            transaction.on_commit(lambda: cls._dispatch_push(message.id, sender_id))
        logger.info("[ChannelService] Message %s posted to channel %s by UID:%s", message.id, channel.id, sender_id)
        return message

    @classmethod
    def mark_read(cls, *, channel: ProjectChannel, user_id: int) -> None:
        cls._touch_read(channel.id, user_id, when=timezone.now())

    @staticmethod
    def _touch_read(channel_id: UUID, user_id: int, *, when: datetime) -> None:
        # Updates the existing active membership row; access layer guarantees one exists.
        ChannelMembership.objects.filter(channel_id=channel_id, user_id=user_id).update(last_read_at=when)

    @classmethod
    def set_push_pref(cls, *, channel: ProjectChannel, user_id: int, enabled: bool) -> None:
        ChannelMembership.objects.filter(channel_id=channel.id, user_id=user_id).update(push_enabled=enabled)

    @classmethod
    def set_pinned(cls, *, message: ChannelMessage, pinned: bool) -> ChannelMessage:
        message.is_pinned = pinned
        message.save(update_fields=['is_pinned', 'updated_at'])
        return message

    @classmethod
    def _dispatch_push(cls, message_id: UUID, sender_id: int) -> None:
        """Push only to current members who opted in for this channel (excluding
        the sender). A seat that outlived its source reaches nobody, the same as
        it opens nothing (`current_memberships`)."""
        try:
            message = ChannelMessage.objects.select_related(
                'channel', 'channel__project', 'sender'
            ).get(id=message_id)
        except ChannelMessage.DoesNotExist:
            return

        channel = message.channel
        recipient_ids = list(
            current_memberships()
            .filter(channel=channel, push_enabled=True)
            .exclude(user_id=sender_id)
            .values_list('user_id', flat=True)
        )
        if not recipient_ids:
            return

        metadata = {
            'channel_id': str(channel.id),
            'project_name': getattr(channel.project, 'title', '') or '',
            'sender_name': user_display_name(message.sender),
            'snippet': (message.body or '')[:_SNIPPET_LEN],
        }
        for uid in recipient_ids:
            send_push_notification_task.delay(
                recipient_id=str(uid),
                notification_type=NotificationType.CHANNEL_MESSAGE,
                metadata=metadata,
                level=NotificationLevel.INFO,
            )
