"""
@file day_plan_queries.py
@description The saved venues a project's day plan sends its reader to. A
    run-sheet point names its place by ``location_id`` inside unvalidated JSON,
    so every surface that states a point's place (the call sheet, the calendar
    entry, the reminder) resolves it here and degrades a bad reference the same
    way: to no place, never to an error. The flat plan-start facts a
    notification carries (the reminder, the invitation) are assembled here too,
    since naming that moment's place is the part that needs the database.
@architecture Enterprise SaaS 2026
@module roster/queries/day_plan_queries
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from typing import TYPE_CHECKING

from logistics.models import Location
from roster.domain.day_timeline import PlanBounds, RunSheetPoint

if TYPE_CHECKING:
    from roster.models import Project


def resolve_point_venues(points: Iterable[RunSheetPoint]) -> dict[str, Location]:
    """The venues the given points send the reader to, keyed by the stored
    ``location_id``, in one query.

    The JSON carries no referential integrity: an id that is not a UUID, or one
    whose venue has since been deleted, simply resolves to nothing and the point
    is stated without a place. A dangling reference must never take a call sheet
    or a calendar feed down.
    """
    ids: list[uuid.UUID] = []
    for point in points:
        if not point.location_id:
            continue
        try:
            ids.append(uuid.UUID(point.location_id))
        except ValueError:
            continue
    if not ids:
        return {}
    return {str(pk): location for pk, location in Location.objects.in_bulk(ids).items()}


def point_venue_name(point: RunSheetPoint | None, event_venue_id: object) -> str:
    """The name of the place a point sends the reader to, or nothing when the
    point is at the event's own venue. An empty place has always meant the
    venue, and a surface that already states the venue does not repeat it."""
    if point is None or not point.location_id:
        return ''
    if event_venue_id and point.location_id == str(event_venue_id):
        return ''
    venue = resolve_point_venues([point]).get(point.location_id)
    return venue.name if venue is not None else ''


def plan_start_metadata(project: Project, bounds: PlanBounds | None) -> dict[str, str]:
    """Where one reader's plan starts, as the flat facts a notification payload
    carries, when that is before the call; empty otherwise, so a one-day
    concert's payload reads exactly as it always has.

    ``plan_starts_at`` is the ISO moment. A point travels with its own title
    (``plan_start_title``), which is the manager's text; a typed window travels
    as its key (``plan_start_window``), because each composer names it in the
    reader's language. ``plan_start_place`` names the point's venue, or nothing
    when the point is at the event's own.
    """
    if bounds is None or not bounds.opens_before_call:
        return {}
    first = bounds.first
    facts = {'plan_starts_at': first.at.isoformat()}
    if first.point is not None:
        facts['plan_start_title'] = first.point.title
    if first.window:
        facts['plan_start_window'] = first.window
    facts['plan_start_place'] = point_venue_name(first.point, project.location_id)
    return facts
