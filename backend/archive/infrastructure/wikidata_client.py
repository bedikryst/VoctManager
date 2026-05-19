"""
===============================================================================
Score Package Compiler — Wikidata Client
===============================================================================
Domain: Archive / External Clients
Description:
    Thin client over the Wikidata Action API + Wikipedia REST summary endpoint.
    Used to enrich a Composer after MusicBrainz has given us the canonical
    mbid: Wikidata cross-references mbid → QID (via property P434), and from
    the QID we pull biography summary, portrait image, nationality, period.

    Endpoints used:
      * GET https://www.wikidata.org/w/api.php  (action=wbsearchentities, wbgetentities)
      * GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}

    Portraits come from Wikimedia Commons; the URL is built from the image
    filename returned by Wikidata property P18. The portrait license is the
    image's own license (Wikidata doesn't carry it inline — we mark it
    'wikimedia-commons' so callers know to fetch the upstream license if
    they need to display it).

Standards: SaaS 2026, attribution-aware, gracefully degraded on missing data.
===============================================================================
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from archive.dtos import ComposerLookupResult
from archive.infrastructure._http import (
    ExternalAPIError, ExternalAPIUnavailable, cached_get_json,
)

logger = logging.getLogger(__name__)


class WikidataClient:
    """Stateless classmethod-style client."""

    WIKIDATA_API = "https://www.wikidata.org/w/api.php"
    WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
    COMMONS_FILE_URL = "https://commons.wikimedia.org/wiki/Special:FilePath"
    SOURCE = "wiki"

    @classmethod
    def enrich_composer_by_mbid(cls, mbid: UUID) -> Optional[ComposerLookupResult]:
        """
        Look up a composer's Wikidata entity via their MusicBrainz mbid
        (Wikidata property P434), then return bio + portrait + dates.
        Returns None if no Wikidata entry exists for this mbid.
        """
        qid = cls._find_qid_by_mbid(mbid)
        if not qid:
            return None
        return cls._entity_to_composer(qid)

    @classmethod
    def enrich_composer_by_name(cls, name: str) -> Optional[ComposerLookupResult]:
        """
        Fallback: search Wikidata by name when we don't have a mbid yet.
        Less reliable than the mbid path — only use when MusicBrainz has
        no match (e.g., contemporary composers).
        """
        if not name.strip():
            return None
        qid = cls._search_qid_by_name(name)
        if not qid:
            return None
        return cls._entity_to_composer(qid)

    # -- internals ----------------------------------------------------------

    @classmethod
    def _find_qid_by_mbid(cls, mbid: UUID) -> Optional[str]:
        # Wikidata Query Service (SPARQL) is canonical but heavy.
        # The Action API search via haswbstatement is lighter for this lookup.
        params = {
            'action': 'query',
            'list': 'search',
            'srsearch': f'haswbstatement:P434={mbid}',
            'srnamespace': 0,
            'srlimit': 1,
            'format': 'json',
            'origin': '*',
        }
        # haswbstatement search is served via the main wikipedia endpoint, not w.api.
        url = "https://www.wikidata.org/w/api.php"
        data = cls._get(url, params)
        if data is None:
            return None
        hits = (data.get('query') or {}).get('search') or []
        if not hits:
            return None
        title = hits[0].get('title', '')
        # Wikidata entity pages have titles like "Q1339".
        if title.startswith('Q') and title[1:].isdigit():
            return title
        return None

    @classmethod
    def _search_qid_by_name(cls, name: str) -> Optional[str]:
        params = {
            'action': 'wbsearchentities',
            'search': name,
            'language': 'en',
            'limit': 5,
            'type': 'item',
            'format': 'json',
            'origin': '*',
        }
        data = cls._get(cls.WIKIDATA_API, params)
        if data is None:
            return None
        hits = data.get('search') or []
        for hit in hits:
            description = (hit.get('description') or '').lower()
            # Prefer hits whose Wikidata description mentions composer.
            if 'composer' in description:
                return hit.get('id')
        return hits[0].get('id') if hits else None

    @classmethod
    def _entity_to_composer(cls, qid: str) -> Optional[ComposerLookupResult]:
        params = {
            'action': 'wbgetentities',
            'ids': qid,
            'props': 'labels|descriptions|claims|sitelinks/urls',
            'languages': 'en',
            'sitefilter': 'enwiki',
            'format': 'json',
            'origin': '*',
        }
        data = cls._get(cls.WIKIDATA_API, params)
        if data is None:
            return None

        entity = (data.get('entities') or {}).get(qid)
        if not entity:
            return None

        label = ((entity.get('labels') or {}).get('en') or {}).get('value', '')
        parts = label.split(' ', 1)
        first = parts[0] if len(parts) == 2 else ''
        last = parts[1] if len(parts) == 2 else label

        claims = entity.get('claims') or {}
        birth_year = _claim_year(claims.get('P569'))       # date of birth
        death_year = _claim_year(claims.get('P570'))       # date of death
        country_qid = _claim_country(claims.get('P27'))    # country of citizenship
        nationality = cls._resolve_label(country_qid) if country_qid else ""
        portrait_url = _claim_image(claims.get('P18'))     # image

        # Wikipedia summary for the bio (better prose than Wikidata descriptions).
        bio = ""
        sitelinks = entity.get('sitelinks') or {}
        enwiki = sitelinks.get('enwiki') or {}
        wiki_title = enwiki.get('title')
        if wiki_title:
            bio = cls._fetch_wikipedia_summary(wiki_title) or ""

        period = _period_from_birth_year(birth_year)

        return ComposerLookupResult(
            wikidata_qid=qid,
            canonical_first_name=first,
            canonical_last_name=last,
            birth_year=birth_year,
            death_year=death_year,
            nationality=nationality,
            period=period,
            bio=bio,
            portrait_url=portrait_url,
            portrait_license='wikimedia-commons',
            aliases=(),
            source='wikidata',
        )

    @classmethod
    def _fetch_wikipedia_summary(cls, title: str) -> Optional[str]:
        # The REST summary endpoint URL-encodes the title via path segment.
        url = f"{cls.WIKIPEDIA_SUMMARY}/{title.replace(' ', '_')}"
        data = cls._get(url, params=None)
        if data is None:
            return None
        return (data.get('extract') or '').strip() or None

    @classmethod
    def _resolve_label(cls, qid: str) -> str:
        """
        Resolve a Wikidata Q-id to its English label (e.g. 'Q34266' → 'Russia').
        Returns the raw QID as a graceful fallback if the lookup fails — better
        than nothing, and the conductor can fix it manually in the review modal.
        Hits the cache after the first lookup per QID (30-day TTL), so common
        nationalities cost zero from the second composer onward.
        """
        params = {
            'action': 'wbgetentities',
            'ids': qid,
            'props': 'labels',
            'languages': 'en',
            'format': 'json',
            'origin': '*',
        }
        data = cls._get(cls.WIKIDATA_API, params)
        if data is None:
            return qid
        try:
            label = data['entities'][qid]['labels']['en']['value']
        except (KeyError, TypeError):
            return qid
        return label.strip() or qid

    @classmethod
    def _get(cls, url: str, params: Optional[dict]) -> Optional[dict]:
        try:
            result = cached_get_json(source=cls.SOURCE, url=url, params=params)
            return result.data
        except ExternalAPIError as exc:
            logger.error("wiki.error url=%s err=%s", url, exc)
            return None
        except ExternalAPIUnavailable as exc:
            logger.warning("wiki.unavailable url=%s err=%s", url, exc)
            return None


# ---------------------------------------------------------------------------
# Claim parsers — Wikidata's JSON shape is nested and verbose
# ---------------------------------------------------------------------------

def _claim_year(claim_list: Optional[list]) -> Optional[int]:
    if not claim_list:
        return None
    try:
        value = claim_list[0]['mainsnak']['datavalue']['value']
        time_str = value.get('time', '')
        # Wikidata times look like '+1685-03-21T00:00:00Z'; year is chars 1-5.
        if time_str.startswith('+') or time_str.startswith('-'):
            return int(time_str[1:5])
    except (KeyError, IndexError, ValueError, TypeError):
        return None
    return None


def _claim_country(claim_list: Optional[list]) -> str:
    """Return the bare country Q-id (e.g. 'Q34266'). Callers resolve to a label."""
    if not claim_list:
        return ""
    try:
        return claim_list[0]['mainsnak']['datavalue']['value']['id']
    except (KeyError, IndexError, TypeError):
        return ""


def _claim_image(claim_list: Optional[list]) -> str:
    if not claim_list:
        return ""
    try:
        filename = claim_list[0]['mainsnak']['datavalue']['value']
    except (KeyError, IndexError, TypeError):
        return ""
    # Commons Special:FilePath resolves a filename to a stable image URL.
    # Hash-bucketing is handled server-side; we just URL-encode spaces.
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename.replace(' ', '_')}"


def _period_from_birth_year(year: Optional[int]) -> str:
    """Map a composer's birth year to our EpochChoices code."""
    if year is None:
        return ""
    if year < 1400:
        return "MED"
    if year < 1600:
        return "REN"
    if year < 1750:
        return "BAR"
    if year < 1820:
        return "CLA"
    if year < 1900:
        return "ROM"
    if year < 1975:
        return "M20"
    return "CON"
