from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Count, Prefetch, Q, QuerySet

from roster.models import Attendance, Participation, Project, Rehearsal

if TYPE_CHECKING:
    from django.contrib.auth.models import User


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
    active_parts: list[tuple] = list(
        Participation.objects.filter(artist__user=user, is_deleted=False)
        .exclude(status=Participation.Status.DECLINED)
        .values_list("id", "project_id")
    )
    participation_ids = [pid for pid, _ in active_parts]
    sung_project_ids = {proj_id for _, proj_id in active_parts}
    participation_by_project = {
        str(proj_id): str(pid) for pid, proj_id in active_parts
    }

    # Projects this user conducts (Project.conductor → Artist → user). The
    # conductor is never cast, so they have no Participation — surface their
    # podium projects, and *every* rehearsal within, alongside the projects they
    # sing in. These items simply carry no participation id (no self-RSVP).
    conducted_project_ids = set(
        Project.objects.filter(
            conductor__user=user, conductor__is_deleted=False
        ).values_list("id", flat=True)
    )
    all_project_ids = sung_project_ids | conducted_project_ids

    # Cancelled projects drop off the schedule entirely. The prefetch mirrors
    # ProjectViewSet.get_queryset so ProjectSerializer.get_cast / get_program
    # resolve without N+1; the count annotations are omitted (the serializer
    # falls back to its `default=0`, and the schedule never reads them).
    projects_qs = (
        Project.objects.filter(id__in=all_project_ids)
        .exclude(status=Project.Status.CANCELLED)
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
