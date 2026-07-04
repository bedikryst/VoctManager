"""Utilities for timezone-safe notification event metadata."""
from __future__ import annotations

import contextlib
from collections.abc import Mapping
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

EVENT_TIME_DISPLAY_FORMAT = "%d.%m.%Y, %H:%M"
_SAFE_FALLBACK_TIMEZONE = "UTC"


def normalize_timezone_name(timezone_name: str | None, fallback_timezone: str) -> str:
    """Return a valid IANA timezone name, falling back to the event domain default."""
    candidates = (
        timezone_name,
        fallback_timezone,
        _SAFE_FALLBACK_TIMEZONE,
    )
    for candidate in candidates:
        if not candidate:
            continue
        try:
            ZoneInfo(candidate)
        except (ValueError, ZoneInfoNotFoundError):
            continue
        return candidate
    return _SAFE_FALLBACK_TIMEZONE


def format_event_time(value: datetime, timezone_name: str | None, fallback_timezone: str) -> str:
    """Render an event datetime in its own venue timezone for channel copy."""
    resolved_timezone = normalize_timezone_name(timezone_name, fallback_timezone)
    if value.tzinfo is None:
        return value.strftime(EVENT_TIME_DISPLAY_FORMAT)
    try:
        local_value = value.astimezone(ZoneInfo(resolved_timezone))
    except (TypeError, ValueError):
        local_value = value
    return local_value.strftime(EVENT_TIME_DISPLAY_FORMAT)


def build_event_time_metadata(
    value: datetime,
    timezone_name: str | None,
    *,
    fallback_timezone: str,
) -> dict[str, str]:
    """Build the canonical event moment payload used by notification metadata."""
    resolved_timezone = normalize_timezone_name(timezone_name, fallback_timezone)
    return {
        "starts_at": value.isoformat(),
        "starts_at_display": format_event_time(value, resolved_timezone, fallback_timezone),
        "timezone": resolved_timezone,
    }


def _parse_iso_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or "T" not in value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def display_event_time(metadata: Mapping[str, Any], *legacy_keys: str) -> str:
    """Resolve the best human display value from canonical or legacy metadata."""
    display_value = metadata.get("starts_at_display") or metadata.get("date_range_display")
    if display_value:
        return str(display_value)

    parsed = _parse_iso_datetime(metadata.get("starts_at"))
    if parsed is not None:
        timezone_name = metadata.get("timezone")
        if timezone_name:
            with contextlib.suppress(TypeError, ValueError, ZoneInfoNotFoundError):
                parsed = parsed.astimezone(ZoneInfo(str(timezone_name)))
        return parsed.strftime(EVENT_TIME_DISPLAY_FORMAT)

    for key in legacy_keys:
        legacy_value = metadata.get(key)
        if legacy_value:
            return str(legacy_value)
    return ""
