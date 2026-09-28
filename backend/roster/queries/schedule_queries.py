from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from uuid import UUID

from django.db.models import Count, Prefetch, Q, QuerySet

from core.permissions import user_is_manager
from core.voice_labels import canonical_section_letters, section_letters_of_seat
from roster.domain.day_timeline import localize
from roster.models import (
    Artist,
    Attendance,
    Participation,
    Project,
    Rehearsal,
    VoiceType,
    is_instrumentalist_account,
)
from roster.permissions import led_project_ids

if TYPE_CHECKING:
    from django.contrib.auth.models import User

# Slack around a wall-clock window before it is handed to the database. Every
# zone on earth sits inside a day of UTC, so the SQL narrows and the exact edges
# are then decided on each rehearsal's own clock.
_WINDOW_SLACK = timedelta(days=1)


@dataclass(frozen=True)
class _ScheduleSeats:
    """Every seat that belongs in one person's schedule, read in one query.

    ``seats`` pairs each participation with its project. ``section_letters``
    are the SATB letters those seats answer a sectional by.
    ``on_site_project_ids`` are the projects whose seat joins the trip on site.
    """

    seats: list[tuple[UUID, UUID]]
    section_letters: str
    on_site_project_ids: set[UUID]


@dataclass(frozen=True)
class ArtistSchedule:
    """The artist schedule read-model, as :func:`get_artist_schedule` builds it.

    ``projects`` is prefetched for ``ProjectSerializer``; ``rehearsals`` is
    annotated ``absent_count`` and prefetched ``my_attendances`` (this artist
    only). ``participation_by_project`` maps ``str(project_id)`` to
    ``str(participation_id)``, so the view stamps the artist's seat onto each
    event for one-tap RSVP without another query. ``on_site_project_ids`` holds
    ``str(project_id)`` where the artist's own seat joins the trip on site; a
    project they run without a seat is never in it — nobody marked them, and
    the plan is theirs in full.
    """

    projects: QuerySet[Project]
    rehearsals: QuerySet[Rehearsal]
    participation_by_project: dict[str, str]
    on_site_project_ids: set[str]


def _schedule_seats(**artist_lookup: Any) -> _ScheduleSeats:
    """`Participation.live_seats` in the shape this module reads it.

    Materialising the pairs here is what lets the dashboard and the absence
    range share one answer: the count a singer is shown before submitting
    cannot disagree with the rows the submission writes, because neither
    re-derives the rule. The letters and the on-site flag ride on the same
    query — a second round trip for either would be paid on every schedule.
    """
    rows = list(
        Participation.live_seats(**artist_lookup).values_list(
            "id", "project_id", "default_voice_line", "artist__voice_type",
            "joins_on_site",
        )
    )
    return _ScheduleSeats(
        seats=[(pid, project_id) for pid, project_id, _line, _type, _on_site in rows],
        section_letters=canonical_section_letters(
            letter
            for _pid, _project_id, voice_line, voice_type, _on_site in rows
            for letter in section_letters_of_seat(voice_type, voice_line)
        ),
        on_site_project_ids={
            project_id for _pid, project_id, _line, _type, joins in rows if joins
        },
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
    schedule_seats = _schedule_seats(artist_id=artist_id)
    seats, section_letters = schedule_seats.seats, schedule_seats.section_letters
    if not seats:
        return []

    participation_by_project = {project_id: pid for pid, project_id in seats}
    participation_ids = [pid for pid, _project_id in seats]
    instrumentalist = Artist.objects.filter(
        id=artist_id, voice_type=VoiceType.INSTRUMENTALIST
    ).exists()

    rehearsals = (
        Rehearsal.objects.filter(
            project_id__in=list(participation_by_project), is_deleted=False
        )
        .filter(
            Rehearsal.calling_q(
                participation_ids,
                instrumentalist=instrumentalist,
                section_letters=section_letters,
            )
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
        if window_start <= local.replace(tzinfo=None) <= window_end:
            matched.append((rehearsal, participation_by_project[rehearsal.project_id]))

    return matched


def get_artist_schedule(user: User) -> ArtistSchedule:
    """
    CQRS Read Model for the Artist Schedule.

    Returns the projects the artist is cast in *and* the projects they run
    without a seat (conducting, standing in, or managing the choir), plus the
    rehearsals they are invited to — every rehearsal, for a project they run —
    each pre-joined with the artist's own attendance, in a fixed
    number of SQL queries. This replaces the former client-side join, where the
    frontend pulled four full collections (rehearsals, participations, projects,
    attendances) and re-joined them in O(n*m) `.find()` loops. The fields are
    described on :class:`ArtistSchedule`.
    """
    # Bounded scope from the artist's own active participations. Typical
    # cardinality is small, so the IN-clauses below are cheap.
    #
    # Drafts are excluded here rather than from `projects_qs` below, so the cast's
    # rehearsals and participation map drop with them in one stroke. A project the
    # cast has not been told about must not appear in their schedule — being cast in
    # an unpublished concert is a plan the conductor is still making. The conductor's
    # own slice (`conducted_project_ids`) is untouched: they are the one planning it.
    schedule_seats = _schedule_seats(artist__user=user)
    active_parts = schedule_seats.seats
    section_letters = schedule_seats.section_letters
    participation_ids = [pid for pid, _ in active_parts]
    sung_project_ids = {proj_id for _, proj_id in active_parts}
    participation_by_project = {
        str(proj_id): str(pid) for pid, proj_id in active_parts
    }

    # Projects this user RUNS — the podium (Project.conductor → Artist → user)
    # and any programme handed to them as a stand-in. Neither is cast, so neither
    # has a Participation: surface those projects, and *every* rehearsal within,
    # alongside the projects they sing in. These items simply carry no
    # participation id (no self-RSVP). Drafts stay for the conductor — they are
    # the one planning them; `led_projects_q` owns that rule and the different
    # one an explicit grant follows. A cancellation is dropped on both sides,
    # exactly as `_schedule_seats` drops it for the cast.
    #
    # `any`: the timeline is where a stand-in finds the evening they were asked
    # to take, so it must not be gated on the scope that opens the music. What
    # each of those evenings actually lets them DO is decided per scope, where
    # it is done.
    conducted_project_ids = set(led_project_ids(user, scope='any'))

    # A manager runs the season without sitting in it — often with no Artist row
    # at all — so no seat and no podium ever puts a date on their timeline. They
    # get the whole calendar on the same terms the podium gets its own projects:
    # every live one, drafts included, cancellations dropped. No participation
    # rides along, so nothing here offers them an RSVP or writes them into a cast.
    seatless_project_ids = conducted_project_ids
    if user_is_manager(user):
        seatless_project_ids = seatless_project_ids | set(
            Project.objects.exclude(status=Project.Status.CANCELLED)
            .values_list('id', flat=True)
        )

    all_project_ids = sung_project_ids | seatless_project_ids

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

    # A rehearsal belongs to the schedule when the user runs its project without
    # a seat in it — conducting or managing, either way they are entitled to
    # every rehearsal — or, in a project they sing in, when it has no explicit
    # invite list (everyone) or it invites the artist's own participation.
    # distinct=True on the count keeps it immune to the M2M join.
    absent_annotation = Count(
        "attendances",
        filter=Q(attendances__status__in=["ABSENT", "EXCUSED"]),
        distinct=True,
    )
    rehearsals_qs = (
        Rehearsal.objects.filter(project_id__in=all_project_ids, is_deleted=False)
        .filter(
            Q(project_id__in=seatless_project_ids)
            | Rehearsal.calling_q(
                participation_ids,
                instrumentalist=is_instrumentalist_account(user),
                section_letters=section_letters,
            )
        )
        .distinct()
        .select_related("project", "location", "led_by")
        .annotate(absent_count=absent_annotation)
        .prefetch_related(
            Prefetch(
                "attendances",
                queryset=Attendance.objects.filter(
                    participation_id__in=participation_ids
                ),
                to_attr="my_attendances",
            ),
            "plan_items__piece",
        )
        .order_by("date_time")
    )

    return ArtistSchedule(
        projects=projects_qs,
        rehearsals=rehearsals_qs,
        participation_by_project=participation_by_project,
        on_site_project_ids={
            str(project_id) for project_id in schedule_seats.on_site_project_ids
        },
    )
