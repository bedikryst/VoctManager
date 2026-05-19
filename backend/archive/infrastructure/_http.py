"""
===============================================================================
Score Package Compiler — Shared HTTP Helper
===============================================================================
Domain: Archive / External Clients
Description:
    Common HTTP machinery for every external-source client (MusicBrainz,
    Wikidata, Spotify, YouTube). Centralises:

      * Timeouts — never block a Celery worker on a slow third party
      * Retries — exponential backoff on 429 / 5xx, honours Retry-After
      * Caching — Redis-backed, keyed by (source, query) hash
      * Polite headers — User-Agent set per project policy
      * Structured logging — every call logs method, URL, status, ms

    The clients themselves stay small and domain-specific; this module
    holds the cross-cutting concerns so all four behave identically.

Standards: SaaS 2026, polite citizen of the open web, cache-first.
===============================================================================
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public configuration knobs
# ---------------------------------------------------------------------------

DEFAULT_TIMEOUT_SECONDS: float = 8.0
DEFAULT_MAX_RETRIES: int = 3
DEFAULT_BACKOFF_BASE: float = 0.5  # seconds — 0.5, 1.0, 2.0
DEFAULT_CACHE_TTL_SECONDS: int = 60 * 60 * 24 * 30  # 30 days


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ExternalAPIError(Exception):
    """Wraps a non-retryable failure (4xx other than 429, parse errors, missing key)."""


class ExternalAPIUnavailable(Exception):
    """Raised after retries are exhausted. Caller's Celery task may retry the whole step."""


# ---------------------------------------------------------------------------
# Cache key helpers
# ---------------------------------------------------------------------------

def make_cache_key(source: str, payload: Mapping[str, Any]) -> str:
    """
    Stable, content-addressed cache key.
    `source` is the client namespace ('mbz', 'wiki', 'sptfy', 'yt').
    `payload` is the request shape (URL + sorted params) — order-independent.
    """
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    digest = hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:32]
    return f"ext:{source}:{digest}"


# ---------------------------------------------------------------------------
# Core HTTP call with retry + cache
# ---------------------------------------------------------------------------

@dataclass
class GetResult:
    """The JSON-decoded response body. Status code already validated."""
    data: Any
    from_cache: bool


def cached_get_json(
    *,
    source: str,
    url: str,
    params: Optional[Mapping[str, Any]] = None,
    headers: Optional[Mapping[str, str]] = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_retries: int = DEFAULT_MAX_RETRIES,
    cache_ttl: int = DEFAULT_CACHE_TTL_SECONDS,
    parse: Callable[[requests.Response], Any] = lambda r: r.json(),
) -> GetResult:
    """
    GET `url` with `params`, returning JSON-decoded body. Caches the *decoded*
    payload by (source, url, params) for `cache_ttl` seconds.

    Retries on 429 / 5xx with exponential backoff, honouring `Retry-After`
    on 429 if present. Raises:

      * ExternalAPIError       — 4xx other than 429 (caller config issue)
      * ExternalAPIUnavailable — retries exhausted on 5xx / network errors
    """
    cache_key = make_cache_key(source, {'url': url, 'params': dict(params or {})})

    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug("ext.cache_hit source=%s url=%s", source, url)
        return GetResult(data=cached, from_cache=True)

    merged_headers = {
        'User-Agent': getattr(settings, 'EXTERNAL_API_USER_AGENT', 'VoctManager/1.0'),
        'Accept': 'application/json',
    }
    if headers:
        merged_headers.update(headers)

    last_exc: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        t0 = time.monotonic()
        try:
            response = requests.get(url, params=params, headers=merged_headers, timeout=timeout)
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning(
                "ext.network_error source=%s url=%s attempt=%d/%d err=%s",
                source, url, attempt + 1, max_retries + 1, exc,
            )
            _sleep_backoff(attempt)
            continue

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        status = response.status_code

        if 200 <= status < 300:
            try:
                data = parse(response)
            except (ValueError, requests.JSONDecodeError) as exc:
                raise ExternalAPIError(
                    f"{source}: failed to decode response from {url}: {exc}"
                ) from exc
            logger.info(
                "ext.ok source=%s url=%s status=%d ms=%d cached=False",
                source, url, status, elapsed_ms,
            )
            cache.set(cache_key, data, timeout=cache_ttl)
            return GetResult(data=data, from_cache=False)

        if status == 429:
            wait = _retry_after_seconds(response) or _backoff_seconds(attempt)
            logger.warning(
                "ext.rate_limited source=%s url=%s wait=%.1fs attempt=%d/%d",
                source, url, wait, attempt + 1, max_retries + 1,
            )
            last_exc = ExternalAPIUnavailable(f"{source}: 429 Too Many Requests")
            time.sleep(wait)
            continue

        if 500 <= status < 600:
            logger.warning(
                "ext.server_error source=%s url=%s status=%d attempt=%d/%d",
                source, url, status, attempt + 1, max_retries + 1,
            )
            last_exc = ExternalAPIUnavailable(f"{source}: {status} from upstream")
            _sleep_backoff(attempt)
            continue

        # 4xx other than 429 — not retryable
        body_excerpt = response.text[:400] if response.text else ''
        raise ExternalAPIError(
            f"{source}: HTTP {status} from {url} — {body_excerpt!r}"
        )

    raise ExternalAPIUnavailable(
        f"{source}: exhausted {max_retries + 1} attempts to {url}"
    ) from last_exc


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _backoff_seconds(attempt: int) -> float:
    """Exponential backoff: 0.5, 1.0, 2.0, 4.0…"""
    return DEFAULT_BACKOFF_BASE * (2 ** attempt)


def _sleep_backoff(attempt: int) -> None:
    time.sleep(_backoff_seconds(attempt))


def _retry_after_seconds(response: requests.Response) -> Optional[float]:
    """Parse the Retry-After header (seconds only — we ignore HTTP-date variants)."""
    value = response.headers.get('Retry-After')
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None
