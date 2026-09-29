"""
@file selectors.py
@description Pure read helpers shared by serializers, views and the service:
             identity payloads, conversation windows, and which channel seats
             still stand. No write logic, no notification side-effects — keeps
             the serializer layer free of any dependency on the
             service/notifications stack.
@architecture Enterprise SaaS 2026
@module messaging/selectors
"""
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Exists, OuterRef, Q, QuerySet

from core.permissions import MANAGER_QUERY_FILTER, user_is_manager
from roster.models import Project
from roster.permissions import led_projects_q

from .models import ChannelMembership, ChannelRole, ProjectChannel

User = get_user_model()

# How many messages one window carries. A conversation is read from its end, so
# the window is the tail; anything older is asked for by cursor.
MESSAGE_PAGE_SIZE = 50


def user_display_name(user: Any | None) -> str:
    """Best available human label for a user: artist full name → full name → email."""
    if user is None:
        return ""
    artist = getattr(user, 'artist_profile', None)
    if artist is not None:
        full = f"{artist.first_name} {artist.last_name}".strip()
        if full:
            return full
    return user.get_full_name() or user.email


def avatar_thumb_url(user: Any | None, request: Any | None = None) -> str | None:
    """Absolute (when a request is present) URL of a user's small avatar render, or None."""
    profile = getattr(user, 'profile', None)
    thumb = getattr(profile, 'avatar_thumb', None)
    if not thumb:
        return None
    return request.build_absolute_uri(thumb.url) if request else thumb.url


def user_brief(user: Any | None, request: Any | None = None) -> dict[str, Any] | None:
    """Compact identity payload for embedding in thread/message representations."""
    if user is None:
        return None
    return {
        'id': user.id,
        'name': user_display_name(user),
        'avatar_url': avatar_thumb_url(user, request),
    }


def current_memberships() -> QuerySet[ChannelMembership]:
    """
    Channel seats whose source still stands — the one answer to "is this person
    in this channel" for access, the unread badge and the push fan-out alike.

    The syncs in `messaging.signals` keep the rows, but not every end of a
    source raises a signal: a leader's grant runs out by the clock, a project
    closes, an account stops being a manager. A row that outlived its source
    stays in the table, so every reader asks here, and such a row opens nothing
    and reaches nobody.

    - A manager's seat stands whatever its role: management opens every channel.
    - A MEMBER seat is trusted as stored: every change to the participation that
      owns it raises a signal.
    - A LEADER seat stands while the person still runs the project, by the same
      predicate every other leader surface asks (`led_projects_q`).
    - A MANAGER seat of someone who is no longer a manager stands on nothing.
    """
    is_manager = User.objects.filter(
        MANAGER_QUERY_FILTER, pk=OuterRef('user_id'), is_active=True,
    )
    leads_project = Project.objects.filter(
        led_projects_q(OuterRef('user_id'), scope='any'),
        pk=OuterRef('channel__project_id'),
    )
    return ChannelMembership.objects.filter(
        Q(Exists(is_manager))
        | Q(role=ChannelRole.MEMBER)
        | Q(Exists(leads_project), role=ChannelRole.LEADER)
    )


def accessible_channels(user: Any) -> QuerySet[ProjectChannel]:
    """Channels ``user`` may open: all of them for a manager (the seat is made
    lazily on first open), otherwise those behind a current seat."""
    if user_is_manager(user):
        return ProjectChannel.objects.all()
    return ProjectChannel.objects.filter(
        pk__in=current_memberships().filter(user_id=user.id).values('channel_id')
    )


def viewer_last_read(context: Mapping[str, Any], thread_id: UUID) -> datetime | None:
    """Looks up the requesting viewer's last-read timestamp from a precomputed map."""
    read_map: dict[UUID, datetime] = context.get('read_map') or {}
    return read_map.get(thread_id)


@dataclass(frozen=True)
class MessagePage[MessageT: models.Model]:
    """
    One window over a conversation, oldest-first — what a client renders.

    ``has_older`` says whether history exists before ``items[0]``, so the client
    knows whether to offer "earlier messages" at all. ``reset`` is the answer to
    a poll that asked for a delta and was too far behind to be given one: the
    window is the current tail and the client must drop what it held, because
    appending it would leave a hole in the middle of the conversation.
    """
    items: list[MessageT]
    has_older: bool
    reset: bool


def _tail_page[MessageT: models.Model](
    queryset: QuerySet[MessageT], *, reset: bool = False
) -> MessagePage[MessageT]:
    """The newest ``MESSAGE_PAGE_SIZE`` rows, oldest-first, with one row of lookahead."""
    rows = list(queryset.order_by('-created_at')[: MESSAGE_PAGE_SIZE + 1])
    return MessagePage(
        items=list(reversed(rows[:MESSAGE_PAGE_SIZE])),
        has_older=len(rows) > MESSAGE_PAGE_SIZE,
        reset=reset,
    )


def paginate_messages[MessageT: models.Model](
    queryset: QuerySet[MessageT],
    *,
    before: UUID | None = None,
    since: datetime | None = None,
) -> MessagePage[MessageT]:
    """
    Windows a conversation's messages. ``before`` walks backwards from a message
    the client already holds; ``since`` asks only for what arrived after a moment
    it already knows about (the poll path — six requests a minute, so the answer
    is normally empty). Neither: the tail.

    An unknown ``before`` cursor answers an empty window rather than an error: it
    means the message it named is gone, and "there is nothing older to give you"
    is both true and harmless, where a 400 on a read path is neither.
    """
    if before is not None:
        cursor = queryset.filter(pk=before).values_list('created_at', flat=True).first()
        if cursor is None:
            return MessagePage(items=[], has_older=False, reset=False)
        return _tail_page(queryset.filter(created_at__lt=cursor))

    if since is not None:
        delta = list(
            queryset.filter(created_at__gt=since).order_by('created_at')[: MESSAGE_PAGE_SIZE + 1]
        )
        if len(delta) <= MESSAGE_PAGE_SIZE:
            # `has_older` is not the client's flag to take from here — a delta says
            # nothing about the history below what the client already holds.
            return MessagePage(items=delta, has_older=False, reset=False)
        return _tail_page(queryset, reset=True)

    return _tail_page(queryset)
