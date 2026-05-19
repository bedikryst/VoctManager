"""
===============================================================================
Score Package Compiler — Spotify Web API Client
===============================================================================
Domain: Archive / External Clients
Description:
    Thin client over the Spotify Web API, using the Client Credentials Flow
    (no user auth — server-to-server OAuth). Tokens last 1 hour and are
    cached in Redis with a margin; the next call after expiry transparently
    re-requests one.

    Endpoints used:
      * POST https://accounts.spotify.com/api/token   (Client Credentials)
      * GET  https://api.spotify.com/v1/search?type=track

    For classical lookups we bias the query toward composer + work title.
    Performer names in classical metadata are highly variable, so we let
    the conductor pick from a ranked list rather than auto-selecting one.

    Get credentials at https://developer.spotify.com/dashboard
    Set SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in your .env.

Standards: SaaS 2026, OAuth2 Client Credentials, token cached.
===============================================================================
"""
from __future__ import annotations

import base64
import logging
import time
from typing import Optional

import requests
from django.conf import settings
from django.core.cache import cache

from archive.dtos import RecordingLookupResult, RecordingSearchResult
from archive.infrastructure._http import (
    ExternalAPIError, ExternalAPIUnavailable, cached_get_json,
)

logger = logging.getLogger(__name__)


class SpotifyClient:
    """Stateless classmethod-style client."""

    TOKEN_URL = "https://accounts.spotify.com/api/token"
    SEARCH_URL = "https://api.spotify.com/v1/search"
    SOURCE = "sptfy"

    # Cache the OAuth token in Redis. Spotify tokens expire after 3600s;
    # we cache for 3300s so we never use one within 5 minutes of expiry.
    _TOKEN_CACHE_KEY = "ext:sptfy:bearer_token"
    _TOKEN_TTL_SECONDS = 3300

    @classmethod
    def search_recordings(
        cls,
        *,
        composer_name: str,
        work_title: str,
        limit: int = 5,
    ) -> RecordingSearchResult:
        """
        Search Spotify for tracks matching composer + work title.
        Returns an empty `RecordingSearchResult` if Spotify is not configured
        or the search fails — callers must always be prepared for empty results.
        """
        query = cls._build_query(composer_name=composer_name, work_title=work_title)
        empty = RecordingSearchResult(query=query, results=())

        token = cls._get_access_token()
        if token is None:
            return empty

        params = {
            'q': query,
            'type': 'track',
            'limit': max(1, min(limit, 20)),
            'market': 'US',
        }
        try:
            result = cached_get_json(
                source=cls.SOURCE,
                url=cls.SEARCH_URL,
                params=params,
                headers={'Authorization': f'Bearer {token}'},
                # Don't cache for the full 30-day default — Spotify catalogue
                # shifts often. One week is a good balance.
                cache_ttl=60 * 60 * 24 * 7,
            )
        except ExternalAPIError as exc:
            logger.error("sptfy.error query=%r err=%s", query, exc)
            return empty
        except ExternalAPIUnavailable as exc:
            logger.warning("sptfy.unavailable query=%r err=%s", query, exc)
            return empty

        items = ((result.data.get('tracks') or {}).get('items')) or []
        recordings = tuple(
            cls._parse_track(track, rank=i)
            for i, track in enumerate(items)
            if track
        )
        return RecordingSearchResult(query=query, results=recordings)

    # -- internals ----------------------------------------------------------

    @staticmethod
    def _build_query(*, composer_name: str, work_title: str) -> str:
        # Spotify supports field filters: `track:` and `artist:`.
        # Composers usually appear in the *artist* field for classical tracks
        # (alongside the performer), so we use that filter on composer name.
        composer = composer_name.strip()
        work = work_title.strip()
        parts = []
        if work:
            parts.append(f'track:"{work}"')
        if composer:
            parts.append(f'artist:"{composer}"')
        return ' '.join(parts) or work or composer

    @staticmethod
    def _parse_track(track: dict, *, rank: int) -> RecordingLookupResult:
        artists = track.get('artists') or []
        performer = ', '.join(
            (a.get('name') or '').strip() for a in artists if a.get('name')
        )
        album = track.get('album') or {}
        year: Optional[int] = None
        release_date = album.get('release_date') or ''
        if release_date:
            try:
                year = int(release_date[:4])
            except ValueError:
                year = None

        duration_ms = track.get('duration_ms') or 0
        return RecordingLookupResult(
            source='spotify',
            external_id=track.get('id', '') or '',
            url=(track.get('external_urls') or {}).get('spotify', '') or '',
            title=(track.get('name') or '').strip(),
            performer=performer,
            year=year,
            duration_seconds=int(duration_ms // 1000) if duration_ms else None,
            relevance_rank=rank,
        )

    @classmethod
    def _get_access_token(cls) -> Optional[str]:
        cached_token = cache.get(cls._TOKEN_CACHE_KEY)
        if cached_token:
            return cached_token

        client_id = getattr(settings, 'SPOTIFY_CLIENT_ID', '')
        client_secret = getattr(settings, 'SPOTIFY_CLIENT_SECRET', '')
        if not client_id or not client_secret:
            logger.warning("sptfy.no_credentials — Spotify search disabled.")
            return None

        basic = base64.b64encode(
            f'{client_id}:{client_secret}'.encode('utf-8')
        ).decode('ascii')

        try:
            t0 = time.monotonic()
            response = requests.post(
                cls.TOKEN_URL,
                data={'grant_type': 'client_credentials'},
                headers={
                    'Authorization': f'Basic {basic}',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': getattr(settings, 'EXTERNAL_API_USER_AGENT', 'VoctManager/1.0'),
                },
                timeout=8.0,
            )
        except requests.RequestException as exc:
            logger.error("sptfy.token_network err=%s", exc)
            return None

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        if response.status_code != 200:
            logger.error(
                "sptfy.token_failed status=%d ms=%d body=%r",
                response.status_code, elapsed_ms, response.text[:200],
            )
            return None

        try:
            payload = response.json()
        except (ValueError, requests.JSONDecodeError) as exc:
            logger.error("sptfy.token_parse err=%s", exc)
            return None

        token = payload.get('access_token')
        if not token:
            logger.error("sptfy.token_missing payload_keys=%s", list(payload.keys()))
            return None

        cache.set(cls._TOKEN_CACHE_KEY, token, timeout=cls._TOKEN_TTL_SECONDS)
        logger.info("sptfy.token_refreshed ms=%d ttl=%ds", elapsed_ms, cls._TOKEN_TTL_SECONDS)
        return token
