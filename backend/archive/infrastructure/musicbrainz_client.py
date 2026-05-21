"""
===============================================================================
Score Package Compiler — MusicBrainz Client
===============================================================================
Domain: Archive / External Clients
Description:
    Thin client over the MusicBrainz Web Service (v2). MusicBrainz is the
    open, structured equivalent of CDDB for classical repertoire — every
    composer and every work has a stable UUID (mbid) we treat as the
    canonical identity.

    Endpoints used:
      * GET /ws/2/work    — search works by title (+ optional composer name)
      * GET /ws/2/artist  — search artists by name
      * GET /ws/2/work/{mbid}    — fetch full work metadata + relationships

    Reference: https://musicbrainz.org/doc/MusicBrainz_API
    Rate limit: 1 request/sec per IP for anonymous; respect strictly.

Standards: SaaS 2026, deterministic dedup, MBID-first.
===============================================================================
"""
from __future__ import annotations

import contextlib
import logging
import time
from uuid import UUID

from archive.dtos import ComposerLookupResult, WorkLookupResult
from archive.infrastructure._http import (
    ExternalAPIError,
    ExternalAPIUnavailable,
    cached_get_json,
)

logger = logging.getLogger(__name__)


class MusicBrainzClient:
    """
    All methods are classmethods — the client is stateless.
    Returns Optional[DTO]; None means 'no canonical match found'.
    """

    BASE_URL = "https://musicbrainz.org/ws/2"
    SOURCE = "mbz"

    # MusicBrainz politeness window — at least 1s between requests per IP.
    # The Redis cache absorbs most repeat queries, so this rarely fires.
    _MIN_INTERVAL_SECONDS = 1.0
    _last_call_at: float = 0.0

    # -- works --------------------------------------------------------------

    @classmethod
    def search_work(
        cls,
        *,
        title: str,
        composer_name: str | None = None,
        limit: int = 5,
    ) -> WorkLookupResult | None:
        """
        Search for a work by title (+ optional composer name disambiguation).
        Returns the highest-scoring match, or None if nothing scores above 70.

        The MB search score is 0-100; 100 = exact title match on canonical form.
        Below 70 is usually a false positive for classical lookups.
        """
        if not title.strip():
            return None

        query = f'work:"{cls._escape(title)}"'
        if composer_name:
            query += f' AND arid:* AND artist:"{cls._escape(composer_name)}"'

        params = {
            'query': query,
            'fmt': 'json',
            'limit': limit,
        }
        data = cls._get('/work', params)
        if data is None:
            return None

        works = data.get('works') or []
        if not works:
            return None

        top = works[0]
        score = int(top.get('score', 0))
        if score < 70:
            logger.info(
                "mbz.work_low_score title=%r best_score=%d — discarding",
                title, score,
            )
            return None

        return cls._parse_work(top, score=score)

    @classmethod
    def get_work(cls, mbid: UUID) -> WorkLookupResult | None:
        """Direct lookup by canonical mbid (cheapest path when we already have it)."""
        params = {'fmt': 'json', 'inc': 'artist-rels'}
        data = cls._get(f'/work/{mbid}', params)
        if data is None:
            return None
        return cls._parse_work(data, score=100)

    # -- composers / artists ------------------------------------------------

    @classmethod
    def search_composer(
        cls,
        *,
        name: str,
        limit: int = 8,
    ) -> ComposerLookupResult | None:
        """
        Search MusicBrainz artists by name. Returns the highest-scoring
        Person match above threshold, or None.

        Notes on the query shape: we deliberately do NOT filter by
        `tag:composer` — the community-tag coverage is patchy for the
        canonical classical canon (Rachmaninoff being a famous example
        of an entry with no `composer` tag), so adding it drops valid
        hits to zero. We also post-filter the candidates so a Group /
        Orchestra / Choir with a similar name never wins over a Person.
        """
        if not name.strip():
            return None

        params = {
            'query': f'artist:"{cls._escape(name)}"',
            'fmt': 'json',
            'limit': limit,
        }
        data = cls._get('/artist', params)
        if data is None:
            return None

        artists = data.get('artists') or []
        if not artists:
            return None

        # Prefer Person results; ignore Group/Orchestra/Choir entries — they
        # are usually ensembles named after the composer ("Rachmaninoff
        # Society") rather than the composer themselves.
        person_artists = [
            a for a in artists if (a.get('type') or 'Person') == 'Person'
        ]
        candidates = person_artists or artists

        top = candidates[0]
        score = int(top.get('score', 0))
        # Matches the work-search threshold (70) — strict enough to filter
        # noise, loose enough to survive romanization spread
        # ("Rachmaninoff" / "Rachmaninov" / "Rakhmaninov").
        if score < 70:
            logger.info(
                "mbz.composer_low_score name=%r best_score=%d — discarding",
                name, score,
            )
            return None

        return cls._parse_composer(top)

    # -- internals ----------------------------------------------------------

    @classmethod
    def _get(cls, path: str, params: dict) -> dict | None:
        cls._respect_rate_limit()
        try:
            result = cached_get_json(
                source=cls.SOURCE,
                url=f'{cls.BASE_URL}{path}',
                params=params,
                # MusicBrainz refuses requests with the default 'application/json'
                # Accept — it returns XML by default and switches on fmt=json.
                headers={'Accept': 'application/json'},
            )
            return result.data
        except ExternalAPIError as exc:
            logger.error("mbz.error path=%s err=%s", path, exc)
            return None
        except ExternalAPIUnavailable as exc:
            logger.warning("mbz.unavailable path=%s err=%s", path, exc)
            return None

    @classmethod
    def _respect_rate_limit(cls) -> None:
        elapsed = time.monotonic() - cls._last_call_at
        if elapsed < cls._MIN_INTERVAL_SECONDS:
            time.sleep(cls._MIN_INTERVAL_SECONDS - elapsed)
        cls._last_call_at = time.monotonic()

    @staticmethod
    def _escape(value: str) -> str:
        """Lucene-escape special chars for MB's search query syntax."""
        # MB search uses Lucene; backslash-escape its reserved set.
        for ch in ('\\', '+', '-', '&&', '||', '!', '(', ')', '{', '}',
                   '[', ']', '^', '~', '*', '?', ':', '/', '"'):
            value = value.replace(ch, f'\\{ch}')
        return value

    @staticmethod
    def _parse_work(data: dict, *, score: int) -> WorkLookupResult | None:
        try:
            mbid = UUID(data['id'])
        except (KeyError, ValueError):
            return None

        composer_mbid: UUID | None = None
        composer_name = ""
        for rel in data.get('relations', []) or []:
            if rel.get('type') == 'composer' and rel.get('artist'):
                artist = rel['artist']
                with contextlib.suppress(TypeError, ValueError):
                    composer_mbid = UUID(artist.get('id'))
                composer_name = artist.get('name', '') or composer_name
                break

        # 'attributes' can carry catalogue numbers (BWV, K., Op. etc.).
        opus_catalog = ""
        for attr in data.get('attributes', []) or []:
            value = attr.get('value', '')
            type_ = attr.get('type', '')
            if value and type_ and any(tag in type_ for tag in ('Catalogue', 'Catalog')):
                opus_catalog = f"{type_.split()[0]} {value}"
                break

        return WorkLookupResult(
            mbid=mbid,
            canonical_title=data.get('title', '').strip(),
            composer_mbid=composer_mbid,
            composer_name=composer_name,
            opus_catalog=opus_catalog,
            musical_key=(data.get('key') or ''),
            language=(data.get('language') or ''),
            work_type=(data.get('type') or ''),
            score=score,
        )

    @staticmethod
    def _parse_composer(data: dict) -> ComposerLookupResult | None:
        try:
            mbid = UUID(data['id'])
        except (KeyError, ValueError):
            return None

        name = (data.get('name') or '').strip()
        parts = name.split(' ', 1)
        first = parts[0] if len(parts) == 2 else ''
        last = parts[1] if len(parts) == 2 else name

        # MB sort-name is often "Last, First" — use it to refine surname.
        sort_name = data.get('sort-name', '')
        if ',' in sort_name:
            last_from_sort, _, first_from_sort = sort_name.partition(',')
            last = last_from_sort.strip()
            first = first_from_sort.strip()

        life_span = data.get('life-span') or {}
        birth_year = _year(life_span.get('begin'))
        death_year = _year(life_span.get('end'))

        nationality = (data.get('country') or '').strip()
        aliases = tuple(
            (a.get('name') or '').strip()
            for a in (data.get('aliases') or [])
            if a.get('name')
        )

        return ComposerLookupResult(
            mbid=mbid,
            canonical_first_name=first,
            canonical_last_name=last,
            birth_year=birth_year,
            death_year=death_year,
            nationality=nationality,
            aliases=aliases,
            source='musicbrainz',
        )


def _year(date_str: str | None) -> int | None:
    """Parse a YYYY or YYYY-MM-DD string into the year, or None."""
    if not date_str:
        return None
    try:
        return int(date_str[:4])
    except (ValueError, TypeError):
        return None
