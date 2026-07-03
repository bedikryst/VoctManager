"""
===============================================================================
Score Package Compiler — Live Ingestion Progress (Server-Sent Events)
===============================================================================
Domain: Archive / Ingestion
Description:
    A single async endpoint that streams an edition's ingestion progress to the
    browser in real time:

        GET /api/archive/editions/<uuid>/events/   →  text/event-stream

    Why SSE (not polling, not WebSockets):
      * The conductor uploads a PDF and must SEE the AI working — step by step,
        cost ticking, and crucially the "service busy, retrying" state during an
        overload — instead of a static "in progress" that only appears once the
        piece resolves. SSE is a one-way server→client push, exactly this shape.
      * Runs as an async view under ASGI (uvicorn), so one worker holds many
        open streams on the event loop rather than blocking a thread each.
      * Sourced from the DB (the single source of truth the Celery tasks write),
        so it is naturally consistent, survives worker restarts, and has no
        pub/sub to miss events on. The poll is async (`.afirst()`), cheap, and
        only alive for the ~30s of an ingestion.

    Auth reuses the app's cookie JWT (`CookieJWTAuthentication`); the browser
    sends the httpOnly `access_token` cookie automatically with
    `EventSource(url, { withCredentials: true })`. Manager-only.

Standards: SaaS 2026, ASGI-native, DB-sourced SSE.
===============================================================================
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from typing import cast

from asgiref.sync import sync_to_async
from django.core.cache import cache
from django.http import (
    Http404,
    HttpRequest,
    HttpResponseBase,
    JsonResponse,
    StreamingHttpResponse,
)
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.request import Request
from rest_framework_simplejwt.exceptions import TokenError

from archive.models import IngestionStatus, ScoreEdition
from archive.tasks import live_preview_cache_key
from core.authentication import CookieJWTAuthentication

logger = logging.getLogger(__name__)

# Poll cadence and connection hygiene. Heartbeats sit comfortably under nginx's
# default 60s proxy_read_timeout so an idle (no-change) stream is never dropped.
_POLL_INTERVAL_SECONDS = 1.5
_HEARTBEAT_EVERY_SECONDS = 20.0
_MAX_STREAM_SECONDS = 30 * 60

_TERMINAL_STATUSES = {
    IngestionStatus.AWAITING,
    IngestionStatus.READY,
    IngestionStatus.FAILED,
}

_SNAPSHOT_FIELDS = (
    'ingestion_status',
    'ingestion_progress',
    'ingestion_error',
    'ingestion_cost_cents',
    'ingestion_cost_cents_lifetime',
    'page_count',
    'piece_id',
)


@sync_to_async
def _authenticate(request: HttpRequest):
    """Run the cookie/JWT auth (DB + CSRF) off the event loop. Returns the user
    or None; raises on an invalid token / CSRF failure."""
    # DRF's auth class is typed for a DRF Request but only touches .COOKIES /
    # .META / CSRF, all present on the ASGI HttpRequest.
    result = CookieJWTAuthentication().authenticate(cast("Request", request))
    return result[0] if result else None


@sync_to_async
def _is_manager(user) -> bool:
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if user.is_staff:
        return True
    profile = getattr(user, 'profile', None)
    return bool(profile and getattr(profile, 'is_manager', False))


async def _snapshot(pk) -> dict | None:
    return await (
        ScoreEdition.objects.filter(pk=pk).values(*_SNAPSHOT_FIELDS).afirst()
    )


async def _live_preview(pk) -> dict | None:
    """The throttled partial-analysis preview the streaming callback publishes
    while Claude reads the score (see `tasks._LiveAnalysisProgress`). Absent
    (None) outside the analysis step."""
    value = await cache.aget(live_preview_cache_key(str(pk)))
    return value if isinstance(value, dict) else None


def _format(event: str, snap: dict | None, live: dict | None = None) -> str:
    if snap is None:
        return f"event: {event}\ndata: {{}}\n\n"
    payload = {
        'ingestion_status': snap['ingestion_status'],
        'ingestion_progress': snap['ingestion_progress'] or '',
        'ingestion_error': snap['ingestion_error'] or '',
        'ingestion_cost_cents': snap['ingestion_cost_cents'],
        'ingestion_cost_cents_lifetime': snap['ingestion_cost_cents_lifetime'],
        'page_count': snap['page_count'],
        'piece_id': str(snap['piece_id']) if snap['piece_id'] else None,
        'live_preview': live,
    }
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


async def _event_stream(pk) -> AsyncIterator[str]:
    """Async generator: emit a `progress` event on every change, a comment
    heartbeat otherwise, and a terminal `done`/`gone`/`timeout` then stop."""
    started = time.monotonic()
    last_signature = None
    last_emit = started
    # Prime the stream immediately so the client paints the current state at once.
    while True:
        snap = await _snapshot(pk)
        if snap is None:
            yield _format('gone', None)
            return

        live = await _live_preview(pk)
        signature = (
            snap['ingestion_status'],
            snap['ingestion_progress'],
            snap['ingestion_cost_cents'],
            snap['ingestion_error'],
            # The preview mutates every ~1.2s during the analysis call — this
            # is exactly what makes the stream feel alive while the DB row
            # itself doesn't change for a minute.
            json.dumps(live, sort_keys=True) if live else '',
        )
        now = time.monotonic()
        if signature != last_signature:
            last_signature = signature
            last_emit = now
            yield _format('progress', snap, live)
            if snap['ingestion_status'] in _TERMINAL_STATUSES:
                yield _format('done', snap, live)
                return
        elif now - last_emit >= _HEARTBEAT_EVERY_SECONDS:
            last_emit = now
            yield ": keepalive\n\n"

        if now - started >= _MAX_STREAM_SECONDS:
            yield _format('timeout', snap)
            return
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)


async def score_edition_events(request: HttpRequest, pk) -> HttpResponseBase:
    """SSE endpoint for one edition's live ingestion progress (manager-only)."""
    if request.method != 'GET':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    try:
        user = await _authenticate(request)
    except (AuthenticationFailed, PermissionDenied, TokenError):
        user = None

    if not await _is_manager(user):
        return JsonResponse({'detail': 'Authentication required.'}, status=401)

    if await _snapshot(pk) is None:
        raise Http404('Edition not found.')

    response = StreamingHttpResponse(
        _event_stream(pk), content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache, no-transform'
    # Tell nginx (and any proxy that honours it) not to buffer this response —
    # SSE must flush each event immediately.
    response['X-Accel-Buffering'] = 'no'
    return response
