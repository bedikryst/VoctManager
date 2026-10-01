"""
@file absence_accept.py
@description "Accept" on the push of an absence request: the manager excuses the
             absence from the notification itself, without opening the panel.

             The service worker that handles the tap cannot act as the manager.
             The session sits in an HttpOnly cookie it cannot read, expires
             within minutes and is refreshed by the app, and cookie auth demands
             a CSRF token the worker does not hold. So the push carries its own
             authority: a token signed for this one purpose, naming the manager
             and the in-app row of the request, expiring when the request's last
             evening starts. The row holds the attendance rows to excuse, so the
             token stays the same size however many evenings a span reaches. The
             push payload is encrypted end to end to the device, the same trust
             as an e-mail one-click link. A token is spent once it has excused.

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
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, replace
from typing import Any

from django.core import signing
from django.core.cache import cache
from django.utils.translation import gettext as _

from .message_content import (
    FOLD_ITEMS_KEY,
    ITEM_ID_KEY,
    NOTIFICATION_IDS_KEY,
    AcceptOffer,
    PushAction,
    PushPayload,
    _is_span,
)
from .models import NotificationType
from .time_metadata import event_end, event_start

ACCEPT_URL = "/api/notifications/absence-accept/"

_SALT = "notifications.absence-accept"
_SPENT_KEY_PREFIX = "absence-accept:spent:"


class InvalidAcceptToken(Exception):
    """The token is forged, altered, expired or not this endpoint's."""


@dataclass(frozen=True)
class AcceptGrant:
    """What a verified token authorises: one manager excusing one request, the
    absence request row of theirs that names it."""
    manager_id: int
    notification_id: str
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


def _request_row(request: Mapping[str, Any], metadata: Mapping[str, Any]) -> str | None:
    """The in-app row a request was read from: named on it when the fold sent it,
    or the one row a push sent on its own speaks for."""
    own = request.get(ITEM_ID_KEY)
    if own:
        return str(own)
    ids = list(metadata.get(NOTIFICATION_IDS_KEY) or ())
    return str(ids[0]) if len(ids) == 1 else None


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
    has nothing left to accept. A request filed before requests named their
    attendance rows has nothing to excuse by. A request whose last evening has
    started gets no button, because its token would be born expired.
    """
    if not is_manager:
        return payload
    request = _single_request(notification_type, metadata)
    if request is None or request.get("status") != "ABSENT" or not request.get("attendance_ids"):
        return payload
    notification_id = _request_row(request, metadata)
    last_evening = event_end(request) if _is_span(request) else event_start(request)
    if notification_id is None or last_evening is None:
        return payload
    expires_at = int(last_evening.timestamp())
    if expires_at <= time.time():
        return payload

    token = signing.dumps(
        {"m": int(recipient_id), "n": notification_id, "e": expires_at}, salt=_SALT,
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
    if not isinstance(data, dict):
        raise InvalidAcceptToken
    manager_id, notification_id, expires_at = data.get("m"), data.get("n"), data.get("e")
    if (
        not isinstance(manager_id, int)
        or not isinstance(notification_id, str)
        or not isinstance(expires_at, int)
    ):
        raise InvalidAcceptToken
    try:
        uuid.UUID(notification_id)
    except ValueError as exc:
        raise InvalidAcceptToken from exc
    if expires_at <= time.time():
        raise InvalidAcceptToken
    return AcceptGrant(
        manager_id=manager_id, notification_id=notification_id, expires_at=expires_at,
    )


def _spent_key(token: str) -> str:
    return _SPENT_KEY_PREFIX + hashlib.sha256(token.encode()).hexdigest()


def is_spent(token: str) -> bool:
    """Whether this token has already excused its request. A second tap — the
    same push on the manager's other device — then reports the request as
    accepted, which it is, rather than excusing anything a second time."""
    return bool(cache.get(_spent_key(token)))


def spend(token: str, grant: AcceptGrant) -> None:
    """Mark the token used, once its write has committed, for as long as it
    would stay valid.

    Never before the write: a tap refused because the singer withdrew the
    absence, or one that failed, must not leave a later tap reporting success.
    Two taps racing past `is_spent` are safe without it, since the service
    excuses a row only while it still reads ABSENT, under a row lock.
    """
    cache.set(_spent_key(token), True, timeout=max(grant.expires_at - int(time.time()), 1))
