"""
@file serializers.py
@description DRF serializers for the messaging domain. Read serializers compute
             per-viewer state (unread, is_mine) from request/context; write
             serializers validate inbound payloads only — role resolution and
             persistence live in the view + service layers.
@architecture Enterprise SaaS 2026
@module messaging/serializers
"""
from typing import Any

from rest_framework import serializers

from .models import (
    ChannelMessage,
    Message,
    ProjectChannel,
    Thread,
    ThreadContextType,
    ThreadStatus,
)
from .selectors import user_brief, viewer_last_read

_SNIPPET_LEN = 140


class MessageSerializer(serializers.ModelSerializer):
    """A single message with author brief and a viewer-relative ``is_mine`` flag."""
    sender = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'body', 'created_at', 'sender', 'is_mine']
        read_only_fields = fields

    def get_sender(self, obj: Message) -> dict[str, Any] | None:
        return user_brief(obj.sender)

    def get_is_mine(self, obj: Message) -> bool:
        request = self.context.get('request')
        return bool(request and obj.sender_id == request.user.id)


class _ThreadBaseSerializer(serializers.ModelSerializer):
    """Shared read fields for thread list/detail representations."""
    artist = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = [
            'id', 'subject', 'context_type', 'context_id', 'status',
            'last_message_at', 'created_at', 'artist', 'assignee', 'unread',
        ]
        read_only_fields = fields

    def get_artist(self, obj: Thread) -> dict[str, Any]:
        artist = obj.artist
        return {
            'id': str(artist.id),
            'name': f"{artist.first_name} {artist.last_name}".strip(),
            'voice_type': artist.voice_type,
        }

    def get_assignee(self, obj: Thread) -> dict[str, Any] | None:
        return user_brief(obj.assignee)

    def get_unread(self, obj: Thread) -> bool:
        last_read = viewer_last_read(self.context, obj.id)
        return last_read is None or obj.last_message_at > last_read


class ThreadListSerializer(_ThreadBaseSerializer):
    """Inbox row. Relies on a ``last_body`` annotation for the preview snippet."""
    snippet = serializers.SerializerMethodField()

    class Meta(_ThreadBaseSerializer.Meta):
        fields = [*_ThreadBaseSerializer.Meta.fields, 'snippet']
        read_only_fields = fields

    def get_snippet(self, obj: Thread) -> str:
        body = getattr(obj, 'last_body', None) or ''
        return body[:_SNIPPET_LEN]


class ThreadDetailSerializer(_ThreadBaseSerializer):
    """Full conversation with its ordered messages."""
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(_ThreadBaseSerializer.Meta):
        fields = [*_ThreadBaseSerializer.Meta.fields, 'messages']
        read_only_fields = fields


class ThreadCreateSerializer(serializers.Serializer):
    """
    Inbound payload for opening a thread. ``artist_id`` is consumed only when the
    requester is a manager; ``assignee_id`` is the optional manager an artist directs
    the thread to. Role resolution happens in the view.
    """
    subject = serializers.CharField(max_length=160)
    body = serializers.CharField(max_length=4000)
    context_type = serializers.ChoiceField(choices=ThreadContextType.choices, default=ThreadContextType.GENERAL)
    context_id = serializers.UUIDField(required=False, allow_null=True)
    artist_id = serializers.UUIDField(required=False, allow_null=True)
    assignee_id = serializers.IntegerField(required=False, allow_null=True)


class MessageCreateSerializer(serializers.Serializer):
    """Inbound payload for posting a reply."""
    body = serializers.CharField(max_length=4000)


class ThreadUpdateSerializer(serializers.Serializer):
    """Manager-only triage payload. At least one field must be present."""
    assignee_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=ThreadStatus.choices, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if 'assignee_id' not in attrs and 'status' not in attrs:
            raise serializers.ValidationError("Provide at least one of: assignee_id, status.")
        return attrs


# ===========================================================================
# Project channels (group conversation per project)
# ===========================================================================


class ChannelMessageSerializer(serializers.ModelSerializer):
    """A single channel message with author brief and a viewer-relative flag."""
    sender = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ChannelMessage
        fields = ['id', 'body', 'created_at', 'is_pinned', 'sender', 'is_mine']
        read_only_fields = fields

    def get_sender(self, obj: ChannelMessage) -> dict[str, Any] | None:
        return user_brief(obj.sender)

    def get_is_mine(self, obj: ChannelMessage) -> bool:
        request = self.context.get('request')
        return bool(request and obj.sender_id == request.user.id)


class _ChannelBaseSerializer(serializers.ModelSerializer):
    """Shared read fields for channel list/detail. Relies on a `member_count` annotation."""
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    unread = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectChannel
        fields = ['id', 'project_id', 'project_name', 'last_message_at', 'created_at', 'unread', 'member_count']
        read_only_fields = fields

    def get_unread(self, obj: ProjectChannel) -> bool:
        if obj.last_message_at is None:
            return False
        last_read = viewer_last_read(self.context, obj.id)
        return last_read is None or obj.last_message_at > last_read

    def get_member_count(self, obj: ProjectChannel) -> int:
        return int(getattr(obj, 'member_count', 0) or 0)


class ChannelListSerializer(_ChannelBaseSerializer):
    """Inbox row for a project channel."""
    snippet = serializers.SerializerMethodField()

    class Meta(_ChannelBaseSerializer.Meta):
        fields = [*_ChannelBaseSerializer.Meta.fields, 'snippet']
        read_only_fields = fields

    def get_snippet(self, obj: ProjectChannel) -> str:
        body = getattr(obj, 'last_body', None) or ''
        return body[:_SNIPPET_LEN]


class ChannelDetailSerializer(_ChannelBaseSerializer):
    """Full channel with ordered messages + the viewer's own push opt-in state."""
    messages = ChannelMessageSerializer(many=True, read_only=True)
    my_push_enabled = serializers.SerializerMethodField()

    class Meta(_ChannelBaseSerializer.Meta):
        fields = [*_ChannelBaseSerializer.Meta.fields, 'my_push_enabled', 'messages']
        read_only_fields = fields

    def get_my_push_enabled(self, obj: ProjectChannel) -> bool:
        return bool(self.context.get('my_push_enabled', False))


class ChannelMessageCreateSerializer(serializers.Serializer):
    """Inbound payload for posting a channel message."""
    body = serializers.CharField(max_length=4000)


class ChannelPushPrefSerializer(serializers.Serializer):
    """Toggle the viewer's per-channel push opt-in."""
    push_enabled = serializers.BooleanField()


class ChannelPinSerializer(serializers.Serializer):
    """Manager pin/unpin of a channel message."""
    pinned = serializers.BooleanField()
