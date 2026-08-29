"""
@file selectors.py
@description Pure read helpers shared by serializers and views. No write logic,
             no notification side-effects — keeps the serializer layer free of any
             dependency on the service/notifications stack.
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
from django.db.models import QuerySet

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
