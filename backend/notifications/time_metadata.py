"""Utilities for timezone-safe notification event metadata."""
from __future__ import annotations

import contextlib
from collections.abc import Mapping
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone as django_timezone
from django.utils.formats import date_format
from django.utils.translation import gettext as _
from django.utils.translation import pgettext

# Language-neutral fallback format. It is persisted into notification metadata at
# emission time — before the recipient (and therefore the language) is known — so
# it must never carry weekday or month names. Human, localized rendering happens
# at send time in humanize_event_time().
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


def _weekday_name(value: datetime) -> str:
    """
    Weekday name as it reads inside a sentence. Deliberately our own strings
    rather than Django's `l` specifier: the bundled Polish catalog capitalizes
    them ("Piątek"), which is wrong mid-sentence, and the casing convention is a
    per-language call that belongs in the catalog, not in a branch here.
    """
    return (
        pgettext("weekday", "Monday"),
        pgettext("weekday", "Tuesday"),
        pgettext("weekday", "Wednesday"),
        pgettext("weekday", "Thursday"),
        pgettext("weekday", "Friday"),
        pgettext("weekday", "Saturday"),
        pgettext("weekday", "Sunday"),
    )[value.weekday()]


def _day_and_month(value: datetime, *, with_year: bool) -> str:
    """
    Day and month ("6 listopada", "6 novembre", "6 November"). The Django format
    string itself is translated, because the specifier that yields a correctly
    cased, correctly inflected month differs per language — `E` gives the Polish
    genitive but a capitalized French month, where `F` is right.
    """
    pattern = (
        pgettext("event date format", "j E Y")
        if with_year
        else pgettext("event date format", "j E")
    )
    return date_format(value, pattern)


def humanize_event_time(value: datetime) -> str:
    """
    Render an event moment the way a person would say it, in the active language:
    "tomorrow at 19:00", "Friday, 19 June at 19:00". The year is stated only when
    it is not the current one, so the common case stays short enough for a push.

    Must run inside the recipient's translation.override — weekday and month names
    come from the active locale. Relative wording is resolved against "now" at call
    time, which is why this is never baked into the stored metadata: a persisted
    "tomorrow" would still say tomorrow a week later.
    """
    clock = date_format(value, "H:i")

    reference_year = datetime.now().year
    if django_timezone.is_aware(value):
        today = django_timezone.localtime(django_timezone.now(), value.tzinfo).date()
        reference_year = today.year
        days_away = (value.date() - today).days
        if days_away == 0:
            return _("today at %(time)s") % {"time": clock}
        if days_away == 1:
            return _("tomorrow at %(time)s") % {"time": clock}

    return _("%(weekday)s, %(date)s at %(time)s") % {
        "weekday": _weekday_name(value),
        "date": _day_and_month(value, with_year=value.year != reference_year),
        "time": clock,
    }


def display_event_time(metadata: Mapping[str, Any], *legacy_keys: str) -> str:
    """
    Resolve the best human display value from canonical or legacy metadata.

    The ISO moment outranks any pre-rendered string: `starts_at_display` is frozen
    at emission time, shared by every recipient, so rendering from the timestamp is
    what lets the copy speak the reader's own language — and say "tomorrow" instead
    of a bare date. The stored display value remains the fallback for legacy rows
    and for multi-day ranges, which have no single moment to render.
    """
    parsed = _parse_iso_datetime(metadata.get("starts_at"))
    if parsed is not None:
        timezone_name = metadata.get("timezone")
        if timezone_name:
            with contextlib.suppress(TypeError, ValueError, ZoneInfoNotFoundError):
                parsed = parsed.astimezone(ZoneInfo(str(timezone_name)))
        return humanize_event_time(parsed)

    display_value = metadata.get("starts_at_display") or metadata.get("date_range_display")
    if display_value:
        return str(display_value)

    for key in legacy_keys:
        legacy_value = metadata.get(key)
        if legacy_value:
            return str(legacy_value)
    return ""
