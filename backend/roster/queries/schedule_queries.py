from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from uuid import UUID

from django.db.models import Count, Prefetch, Q, QuerySet

from roster.domain.day_timeline import localize
from roster.models import Attendance, Participation, Project, Rehearsal

if TYPE_CHECKING:
    from django.contrib.auth.models import User

# Slack around a wall-clock window before it is handed to the database. Every
# zone on earth sits inside a day of UTC, so the SQL narrows and the exact edges
# are then decided on each rehearsal's own clock.
_WINDOW_SLACK = timedelta(days=1)


def _schedule_seats(**artist_lookup: Any) -> list[tuple[UUID, UUID]]:
    """`(participation_id, project_id)` for every seat that belongs in a schedule.

    `Participation.live_seats` in the shape this module reads it. Materialising
    the pairs here is what lets the dashboard and the absence range share one
    answer: the count a singer is shown before submitting cannot disagree with
    the rows the submission writes, because neither re-derives the rule.
    """
    return list(
        Participation.live_seats(**artist_lookup).values_list("id", "project_id")
    )


def get_artist_rehearsals_in_window(
    artist_id: UUID | str,
    window_start: datetime,
    window_end: datetime,
) -> list[tuple[Rehearsal, UUID]]:
    """
    Every rehearsal the artist takes part in whose start falls inside the window,
    each paired with the participation that seat belongs to.

    The window is **wall-clock and inclusive at both ends**: "away until the 21st"
    is a calendar fact, so each rehearsal is judged on its own venue clock rather
    than against a single instant, and a tour crossing timezones keeps its edges.
    Rehearsals of a project the artist merely conducts are absent by construction
    — there is no participation there, so there is no attendance row to write.
    """
    seats = _schedule_seats(artist_id=artist_id)
    if not seats:
        return []

    participation_by_project = {project_id: pid for pid, project_id in seats}
    participation_ids = [pid for pid, _project_id in seats]

    rehearsals = (
        Rehearsal.objects.filter(
            project_id__in=list(participation_by_project), is_deleted=False
        )
        .filter(
            Q(invited_participations__isnull=True)
            | Q(invited_participations__in=participation_ids)
        )
        .filter(
            date_time__gte=(window_start - _WINDOW_SLACK).replace(tzinfo=UTC),
            date_time__lte=(window_end + _WINDOW_SLACK).replace(tzinfo=UTC),
        )
        .distinct()
        .select_related("project")
        .order_by("date_time")
    )

    matched: list[tuple[Rehearsal, UUID]] = []
    for rehearsal in rehearsals:
        local = localize(rehearsal.date_time, rehearsal.timezone)
        if local is None:
            continue
        if window_start <= local.replace(tzinfo=None) <= window_end:
            matched.append((rehearsal, participation_by_project[rehearsal.project_id]))

    return matched


def get_artist_schedule(
    user: User,
) -> tuple[QuerySet[Project], QuerySet[Rehearsal], dict[str, str]]:
    """
    CQRS Read Model for the Artist Schedule.

    Returns the projects the artist is cast in *and* the projects they conduct,
    plus the rehearsals they are invited to (every rehearsal, for a project they
    conduct) — each pre-joined with the artist's own attendance — in a fixed
    number of SQL queries. This replaces the former client-side join, where the
    frontend pulled four full collections (rehearsals, participations, projects,
    attendances) and re-joined them in O(n*m) `.find()` loops.

    Returns:
      projects_qs              → Project queryset (prefetched for ProjectSerializer)
      rehearsals_qs            → Rehearsal queryset, annotated `absent_count` and
                                 prefetched `my_attendances` (this artist only)
      participation_by_project → {str(project_id): str(participation_id)} so the
                                 view can stamp the artist's participation onto
                                 each event for one-tap RSVP without another query.
    """
    # Bounded scope from the artist's own active participations. Typical
    # cardinality is small, so the IN-clauses below are cheap.
    #
    # Drafts are excluded here rather than from `projects_qs` below, so the cast's
    # rehearsals and participation map drop with them in one stroke. A project the
    # cast has not been told about must not appear in their schedule — being cast in
    # an unpublished concert is a plan the conductor is still making. The conductor's
    # own slice (`conducted_project_ids`) is untouched: they are the one planning it.
    active_parts = _schedule_seats(artist__user=user)
    participation_ids = [pid for pid, _ in active_parts]
    sung_project_ids = {proj_id for _, proj_id in active_parts}
    participation_by_project = {
        str(proj_id): str(pid) for pid, proj_id in active_parts
    }

    # Projects this user conducts (Project.conductor → Artist → user). The
    # conductor is never cast, so they have no Participation — surface their
    # podium projects, and *every* rehearsal within, alongside the projects they
    # sing in. These items simply carry no participation id (no self-RSVP).
    # Drafts stay: the conductor is the one planning them. A cancellation is
    # dropped on both sides, exactly as `_schedule_seats` drops it for the cast.
    conducted_project_ids = set(
        Project.objects.filter(conductor__user=user, conductor__is_deleted=False)
        .exclude(status=Project.Status.CANCELLED)
        .values_list("id", flat=True)
    )
    all_project_ids = sung_project_ids | conducted_project_ids

    # Cancellation was already decided upstream, on both id sets, which is what
    # keeps the concert row and its rehearsals from parting company. The prefetch
    # mirrors ProjectViewSet.get_queryset so ProjectSerializer.get_cast /
    # get_program resolve without N+1; the count annotations are omitted (the
    # serializer falls back to its `default=0`, and the schedule never reads them).
    projects_qs = (
        Project.objects.filter(id__in=all_project_ids)
        .select_related("conductor", "location")
        .prefetch_related("participations__artist", "program_items__piece")
        .order_by("date_time")
    )

    # A rehearsal belongs to the schedule when the user conducts its project
    # (they run every rehearsal), or — in a project they sing in — it has no
    # explicit invite list (everyone) or it invites the artist's own
    # participation. distinct=True on the count keeps it immune to the M2M join.
    absent_annotation = Count(
        "attendances",
        filter=Q(attendances__status__in=["ABSENT", "EXCUSED"]),
        distinct=True,
    )
    rehearsals_qs = (
        Rehearsal.objects.filter(project_id__in=all_project_ids, is_deleted=False)
        .filter(
            Q(project_id__in=conducted_project_ids)
            | Q(invited_participations__isnull=True)
            | Q(invited_participations__in=participation_ids)
        )
        .distinct()
        .select_related("project", "location")
        .annotate(absent_count=absent_annotation)
        .prefetch_related(
            Prefetch(
                "attendances",
                queryset=Attendance.objects.filter(
                    participation_id__in=participation_ids
                ),
                to_attr="my_attendances",
            ),
        )
        .order_by("date_time")
    )

    return projects_qs, rehearsals_qs, participation_by_project
