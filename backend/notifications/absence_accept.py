"""
@file absence_accept.py
@description "Accept" on the push of an absence request: the manager excuses the
             absence from the notification itself, without opening the panel.

             The service worker that handles the tap cannot act as the manager.
             The session sits in an HttpOnly cookie it cannot read, expires
             within minutes and is refreshed by the app, and cookie auth demands
             a CSRF token the worker does not hold. So the push carries its own
             authority: a token signed for this one purpose, naming the manager
             and the attendance rows of one request, expiring when the request's
             last evening starts. The push payload is encrypted end to end to the
             device, the same trust as an e-mail one-click link. A token is spent
             on its first use.

             The button goes only on a push about ONE request — a single evening,
             or a span, which is one request over several evenings. A burst
             holding two absences is two decisions, and one tap must not make
             both.
@architecture Enterprise SaaS 2026
@module notifications/absence_accept
"""
from __future__ import annotations

import hashlib
import time
from collections.abc import Mapping
from dataclasses import dataclass, replace
from typing import Any

from django.core import signing
from django.core.cache import cache
from django.utils.translation import gettext as _

from .message_content import (
    FOLD_ITEMS_KEY,
    AcceptOffer,
    PushAction,
    PushPayload,
    _is_span,
)
from .models import NotificationType
from .time_metadata import _parse_iso_datetime

ACCEPT_URL = "/api/notifications/absence-accept/"

_SALT = "notifications.absence-accept"
_EXCUSED = "EXCUSED"
_SPENT_KEY_PREFIX = "absence-accept:spent:"


class InvalidAcceptToken(Exception):
    """The token is forged, altered, expired or not this endpoint's."""


@dataclass(frozen=True)
class AcceptGrant:
    """What a verified token authorises: one manager excusing these rows."""
    manager_id: int
    attendance_ids: list[str]
    expires_at: int


def _single_request(notification_type: str, metadata: Mapping[str, Any]) -> Mapping[str, Any] | None:
    """The one absence request a push is about, or None when it is about none or
    about several."""
    if notification_type != NotificationType.ABSENCE_REQUESTED:
        return None
    folded = metadata.get(FOLD_ITEMS_KEY)
    if not folded:
        return metadata
    absences = [
        item for item in folded
        if isinstance(item, Mapping)
        and item.get("notification_type") == NotificationType.ABSENCE_REQUESTED
    ]
    return absences[0] if len(absences) == 1 else None


def offer(
    payload: PushPayload,
    *,
    recipient_id: str,
    notification_type: str,
    metadata: Mapping[str, Any],
    is_manager: bool,
) -> PushPayload:
    """The push with "Accept" added in front of its own button, when there is
    exactly one absence on it still waiting for a verdict; the push unchanged
    otherwise.

    Waiting means reported as ABSENT, the record a singer writes: an EXCUSED one
    has nothing left to accept. A request whose last evening has started gets no
    button, because its token would be born expired.
    """
    if not is_manager:
        return payload
    request = _single_request(notification_type, metadata)
    if request is None or request.get("status") != "ABSENT":
        return payload
    attendance_ids = [str(value) for value in request.get("attendance_ids") or () if value]
    last_evening = _parse_iso_datetime(
        request.get("ends_at") if _is_span(request) else request.get("starts_at")
    )
    if not attendance_ids or last_evening is None:
        return payload
    expires_at = int(last_evening.timestamp())
    if expires_at <= time.time():
        return payload

    token = signing.dumps(
        {"m": int(recipient_id), "a": attendance_ids, "s": _EXCUSED, "e": expires_at},
        salt=_SALT,
        compress=True,
    )
    artist = request.get("artist_name") or metadata.get("artist_name") or _("A singer")
    done = (
        _("Excused from the rehearsals: %(artist)s")
        if _is_span(request)
        else _("Excused from the rehearsal: %(artist)s")
    ) % {"artist": artist}
    return replace(
        payload,
        actions=(PushAction(action="accept", title=_("Accept")), *payload.actions),
        accept=AcceptOffer(token=token, url=ACCEPT_URL, title=_("Accepted"), body=done),
    )


def read(token: str) -> AcceptGrant:
    """The grant a token carries, once its signature, purpose and expiry hold."""
    try:
        data = signing.loads(token, salt=_SALT)
    except signing.BadSignature as exc:
        raise InvalidAcceptToken from exc
    if not isinstance(data, dict) or data.get("s") != _EXCUSED:
        raise InvalidAcceptToken
    manager_id, attendance_ids, expires_at = data.get("m"), data.get("a"), data.get("e")
    if (
        not isinstance(manager_id, int)
        or not isinstance(expires_at, int)
        or not isinstance(attendance_ids, list)
        or not attendance_ids
        or not all(isinstance(value, str) for value in attendance_ids)
    ):
        raise InvalidAcceptToken
    if expires_at <= time.time():
        raise InvalidAcceptToken
    return AcceptGrant(manager_id=manager_id, attendance_ids=attendance_ids, expires_at=expires_at)


def spend(token: str, grant: AcceptGrant) -> bool:
    """Mark the token used, for as long as it would stay valid. False when it
    already was: a second tap, or a replay, does nothing a second time.

    Spent before the write rather than after it, so two requests racing with
    one token cannot both pass; a write that then fails leaves the manager the
    absence list, which the worker opens on any failure.
    """
    key = _SPENT_KEY_PREFIX + hashlib.sha256(token.encode()).hexdigest()
    return bool(cache.add(key, True, timeout=max(grant.expires_at - int(time.time()), 1)))
