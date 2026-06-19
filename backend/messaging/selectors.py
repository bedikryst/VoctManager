"""
@file selectors.py
@description Pure read helpers shared by serializers and views. No write logic,
             no notification side-effects — keeps the serializer layer free of any
             dependency on the service/notifications stack.
@architecture Enterprise SaaS 2026
@module messaging/selectors
"""
from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model

User = get_user_model()


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
