"""
===============================================================================
Score Package Compiler — YouTube Data API v3 Client
===============================================================================
Domain: Archive / External Clients
Description:
    Thin client over YouTube's Data API v3 for finding performance videos
    of a given work. Uses a simple API key (no OAuth — read-only public data).

    Endpoints used:
      * GET https://www.googleapis.com/youtube/v3/search       (cost: 100 units)
      * GET https://www.googleapis.com/youtube/v3/videos       (cost: 1 unit)

    Daily quota on the free tier is 10,000 units — that's only 100 search
    calls/day. The Redis cache + a 7-day TTL on results keeps us well under
    budget for typical ingestion volume.

    Get an API key at https://console.cloud.google.com/apis/credentials
    Enable "YouTube Data API v3" on the project first.
    Set YOUTUBE_API_KEY in your .env.

Standards: SaaS 2026, quota-aware, cache-first.
===============================================================================
"""
from __future__ import annotations

import logging
import re

from django.conf import settings

from archive.dtos import RecordingLookupResult, RecordingSearchResult
from archive.infrastructure._http import (
    ExternalAPIError,
    ExternalAPIUnavailable,
    cached_get_json,
)

logger = logging.getLogger(__name__)


class YouTubeClient:
    """Stateless classmethod-style client."""

    SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
    VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
    WATCH_URL = "https://www.youtube.com/watch?v="
    SOURCE = "yt"

    @classmethod
    def search_videos(
        cls,
        *,
        composer_name: str,
        work_title: str,
        limit: int = 5,
    ) -> RecordingSearchResult:
        """
        Search YouTube for performance videos. Returns an empty result if
        YouTube is not configured. The two-call flow (search.list →
        videos.list) is needed to get durations: search.list doesn't return
        them; videos.list does.
        """
        query = cls._build_query(composer_name=composer_name, work_title=work_title)
        empty = RecordingSearchResult(query=query, results=())

        api_key = getattr(settings, 'YOUTUBE_API_KEY', '')
        if not api_key:
            logger.warning("yt.no_credentials — YouTube search disabled.")
            return empty

        search_params = {
            'key': api_key,
            'q': query,
            'part': 'snippet',
            'type': 'video',
            'videoEmbeddable': 'true',
            'maxResults': max(1, min(limit, 25)),
            'safeSearch': 'none',
        }
        search_data = cls._get(cls.SEARCH_URL, search_params)
        if search_data is None:
            return empty

        items = search_data.get('items') or []
        if not items:
            return empty

        video_ids = [
            video_id
            for item in items
            if (video_id := (item.get('id') or {}).get('videoId'))
        ]
        if not video_ids:
            return empty

        # Second call: fetch durations via videos.list (cost: 1 unit total).
        videos_params = {
            'key': api_key,
            'id': ','.join(video_ids),
            'part': 'contentDetails,snippet',
        }
        videos_data = cls._get(cls.VIDEOS_URL, videos_params)
        if videos_data is None:
            return empty

        by_id = {v.get('id'): v for v in (videos_data.get('items') or []) if v.get('id')}

        recordings = []
        for rank, vid_id in enumerate(video_ids):
            video = by_id.get(vid_id)
            if not video:
                continue
            recordings.append(cls._parse_video(video, rank=rank))

        return RecordingSearchResult(query=query, results=tuple(recordings))

    # -- internals ----------------------------------------------------------

    @staticmethod
    def _build_query(*, composer_name: str, work_title: str) -> str:
        composer = composer_name.strip()
        work = work_title.strip()
        if composer and work:
            return f'{composer} — {work}'
        return work or composer

    @staticmethod
    def _parse_video(video: dict, *, rank: int) -> RecordingLookupResult:
        snippet = video.get('snippet') or {}
        details = video.get('contentDetails') or {}

        duration_seconds = _parse_iso8601_duration(details.get('duration'))

        year: int | None = None
        published = snippet.get('publishedAt') or ''
        if len(published) >= 4:
            try:
                year = int(published[:4])
            except ValueError:
                year = None

        vid_id = video.get('id', '')
        return RecordingLookupResult(
            source='youtube',
            external_id=vid_id,
            url=f'{YouTubeClient.WATCH_URL}{vid_id}',
            title=(snippet.get('title') or '').strip(),
            performer=(snippet.get('channelTitle') or '').strip(),
            year=year,
            duration_seconds=duration_seconds,
            relevance_rank=rank,
        )

    @classmethod
    def _get(cls, url: str, params: dict) -> dict | None:
        try:
            result = cached_get_json(
                source=cls.SOURCE,
                url=url,
                params=params,
                # YouTube content rarely changes for our purposes; 7 days is
                # plenty and conserves daily quota.
                cache_ttl=60 * 60 * 24 * 7,
            )
            return result.data
        except ExternalAPIError as exc:
            logger.error("yt.error url=%s err=%s", url, exc)
            return None
        except ExternalAPIUnavailable as exc:
            logger.warning("yt.unavailable url=%s err=%s", url, exc)
            return None


# YouTube returns durations as ISO 8601 strings like "PT4M13S" or "PT1H2M".
# This is the only spot in our codebase that needs to parse them — a 4-line
# regex is preferred over pulling in `isodate` for one format.
_ISO8601_DURATION = re.compile(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$')


def _parse_iso8601_duration(value: str | None) -> int | None:
    if not value:
        return None
    match = _ISO8601_DURATION.match(value)
    if not match:
        return None
    hours, minutes, seconds = (int(g) if g else 0 for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds
