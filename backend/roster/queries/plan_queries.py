"""
@file plan_queries.py
@description The rehearsal plan read through one reader's seat: which rows
    call them and the window of the evening they are needed for. Batched over
    a list of rehearsals in a fixed number of queries (seats, castings,
    declared divisi, programme editions, named invitations), then answered row
    by row by `roster.domain.rehearsal_plan` — the schedule dashboard and the
    single-rehearsal read both come through here so a card and its page can
    never state two different windows.
@architecture Enterprise SaaS 2026
@module roster/queries/plan_queries
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, time
from typing import TYPE_CHECKING
from uuid import UUID

from archive.models import PieceVoiceRequirement
from archive.services.voice_scope import requirements_for_edition
from core.constants import VoiceLine
from core.permissions import user_is_manager
from core.voice_labels import section_letters_of_seat
from roster.domain.day_timeline import localize
from roster.domain.rehearsal_plan import (
    PlanRow,
    PlanSeat,
    PlanWindow,
    effective_clocks,
    item_calls_seat,
    plan_window_for_seat,
    row_lines,
)
from roster.models import (
    Participation,
    ProgramItem,
    ProjectPieceCasting,
    Rehearsal,
    RehearsalPlanItem,
    VoiceType,
    instrumental_item_exists,
    is_instrumentalist_account,
)
from roster.permissions import led_project_ids

if TYPE_CHECKING:
    from django.contrib.auth.models import User


@dataclass(frozen=True)
class PlanReading:
    """One reader's answer for one rehearsal: two flags per row, in plan order,
    and the derived window (``None`` when the plan has nothing to say).

    ``opens`` is whether the row's piece opens for this reader at
    ``/panel/materials/<project>/<piece>`` — false for a free row and for an
    instrumental item read through a singer's seat, which the songbook
    withholds. A page linking every piece row would send the singer to "Nie
    znaleziono utworu"; the row itself is the only place that can know."""

    calls: tuple[bool, ...]
    opens: tuple[bool, ...]
    window: PlanWindow | None


def _record_cast_line(lines: dict[str, str], piece_id: str, voice_line: str) -> None:
    """A seat's line on a piece is their choir line. A legacy SOLO row beside it
    is an extra duty and must not replace it; alone, it is all there is."""
    if voice_line != VoiceLine.SOLO or piece_id not in lines:
        lines[piece_id] = voice_line


def plan_lines_for(
    project_ids: Iterable[UUID], piece_ids: Iterable[UUID],
) -> dict[tuple[UUID, UUID], frozenset[str]]:
    """The lines a row offers for exclusion, per (project, piece): the piece's
    declared divisi read through the programme item's explicit edition, or the
    canonical four-part set when nothing is declared. The auto-selected default
    edition is not consulted — only a divisi the conductor pinned to the
    programme can narrow what the chips offer."""
    projects = list(project_ids)
    pieces = list(piece_ids)
    if not projects or not pieces:
        return {}
    requirements: dict[UUID, list[PieceVoiceRequirement]] = {piece_id: [] for piece_id in pieces}
    for requirement in PieceVoiceRequirement.objects.filter(piece_id__in=pieces):
        requirements.setdefault(requirement.piece_id, []).append(requirement)
    editions = {
        (project_id, piece_id): edition_id
        for project_id, piece_id, edition_id in ProgramItem.objects.filter(
            project_id__in=projects, piece_id__in=pieces,
        ).values_list('project_id', 'piece_id', 'score_edition_id')
    }
    return {
        (project_id, piece_id): row_lines(
            row.voice_line
            for row in requirements_for_edition(
                requirements.get(piece_id, []), editions.get((project_id, piece_id)),
            )
        )
        for project_id in projects
        for piece_id in pieces
    }


def plan_rows_of(
    items: Sequence[RehearsalPlanItem],
    lines: Mapping[tuple[UUID, UUID], frozenset[str]],
    project_id: UUID,
) -> list[PlanRow]:
    """The stored rows as the rule reads them."""
    return [
        PlanRow(
            piece=str(item.piece_id) if item.piece_id else None,
            starts_at=item.starts_at,
            lines=(
                lines.get((project_id, item.piece_id), row_lines(()))
                if item.piece_id
                else row_lines(())
            ),
            excluded_lines=frozenset(item.excluded_voice_lines or ()),
            excludes_instrumentalists=item.excludes_instrumentalists,
            is_break=item.is_break,
            minutes=item.minutes,
        )
        for item in items
    ]


def _wall_clock(rehearsal: Rehearsal) -> tuple[time, time | None]:
    start = localize(rehearsal.date_time, rehearsal.timezone)
    end = localize(rehearsal.end_date_time, rehearsal.timezone)
    assert start is not None
    return start.time(), end.time() if end is not None else None


def plan_row_context(
    rehearsal: Rehearsal,
    items: Sequence[RehearsalPlanItem],
    now: datetime | None = None,
) -> dict[str, object]:
    """What `RehearsalPlanItemSerializer` needs to know about the plan as a
    whole, computed once per rehearsal: whether the evening is over (`done`),
    and every row's effective clock keyed by row id (`clock`). ``items`` is
    the WHOLE plan in order, even when fewer rows are serialized — a clock
    depends on every row above it."""
    start, _end = _wall_clock(rehearsal)
    return {
        'plan_over': rehearsal.is_over(now),
        'plan_clocks': dict(
            zip((item.id for item in items), effective_clocks(items, start), strict=True)
        ),
    }


def plan_readings_for_user(
    user: User, rehearsals: Sequence[Rehearsal],
) -> dict[UUID, PlanReading]:
    """Per rehearsal, how the plan reads for ``user``'s seat in that project.

    Keyed by rehearsal id; a rehearsal in a project the user holds no live
    seat in (a manager, a stand-in) has no entry — there is no seat to read
    through, and the serializer then emits no per-reader fields. The
    rehearsals must carry `plan_items` prefetched.
    """
    seats = {
        project_id: (seat_id, section_letters_of_seat(voice_type, voice_line), voice_type)
        for seat_id, project_id, voice_line, voice_type in Participation.live_seats(
            artist__user=user,
        ).values_list('id', 'project_id', 'default_voice_line', 'artist__voice_type')
    }
    readable = [rehearsal for rehearsal in rehearsals if rehearsal.project_id in seats]
    if not readable:
        return {}

    items_by_rehearsal = {
        rehearsal.id: list(rehearsal.plan_items.all()) for rehearsal in readable
    }
    seat_ids = [seats[rehearsal.project_id][0] for rehearsal in readable]
    project_ids = {rehearsal.project_id for rehearsal in readable}
    piece_ids = {
        item.piece_id
        for items in items_by_rehearsal.values()
        for item in items
        if item.piece_id
    }
    lines = plan_lines_for(project_ids, piece_ids)

    cast_lines: dict[UUID, dict[str, str]] = {project_id: {} for project_id in project_ids}
    if piece_ids:
        for project_id, piece_id, voice_line in ProjectPieceCasting.objects.filter(
            participation_id__in=seat_ids, piece_id__in=piece_ids,
        ).values_list('participation__project_id', 'piece_id', 'voice_line'):
            _record_cast_line(cast_lines[project_id], str(piece_id), voice_line)

    # A player named on the invited list is called whatever the rehearsal's
    # flag says — the list IS the call — so the rows read as if the flag were
    # set. One query for every rehearsal at once.
    named_in = set(
        Rehearsal.invited_participations.through.objects.filter(
            rehearsal_id__in=[rehearsal.id for rehearsal in readable],
            participation_id__in=seat_ids,
        ).values_list('rehearsal_id', flat=True)
    )
    withheld = _withheld_pieces(user, project_ids, piece_ids)

    readings: dict[UUID, PlanReading] = {}
    for rehearsal in readable:
        _seat_id, letters, voice_type = seats[rehearsal.project_id]
        seat = PlanSeat(
            section_letters=letters,
            is_instrumentalist=voice_type == VoiceType.INSTRUMENTALIST,
            cast_lines=cast_lines[rehearsal.project_id],
        )
        items = items_by_rehearsal[rehearsal.id]
        rows = plan_rows_of(items, lines, rehearsal.project_id)
        calls_players = rehearsal.calls_instrumentalists or rehearsal.id in named_in
        start, end = _wall_clock(rehearsal)
        readings[rehearsal.id] = PlanReading(
            calls=tuple(
                item_calls_seat(row, seat, calls_instrumentalists=calls_players)
                for row in rows
            ),
            opens=tuple(
                item.piece_id is not None
                and (rehearsal.project_id, item.piece_id) not in withheld
                for item in items
            ),
            window=plan_window_for_seat(
                rows, seat, start=start, end=end, calls_instrumentalists=calls_players,
            ),
        )
    return readings


def _withheld_pieces(
    user: User, project_ids: Iterable[UUID], piece_ids: Iterable[UUID],
) -> frozenset[tuple[UUID, UUID]]:
    """The (project, piece) pairs whose music the materials door refuses this
    reader: a piece the programme does not carry (nothing to open), and an
    instrumental item read through a singer's seat. The same three exemptions
    as `user_is_refused_instrumental` — a manager, a player, whoever runs the
    programme through the materials door — sees every row. One query for
    every project at once, plus the delegation lookup."""
    projects = list(project_ids)
    pieces = list(piece_ids)
    if not projects or not pieces:
        return frozenset()
    programmed: dict[tuple[UUID, UUID], bool] = {
        (project_id, piece_id): bool(instrumental)
        for project_id, piece_id, instrumental in ProgramItem.objects.filter(
            project_id__in=projects, piece_id__in=pieces,
        ).annotate(instrumental=instrumental_item_exists()).values_list(
            'project_id', 'piece_id', 'instrumental',
        )
    }
    unprogrammed = {
        (project_id, piece_id)
        for project_id in projects
        for piece_id in pieces
        if (project_id, piece_id) not in programmed
    }
    if user_is_manager(user) or is_instrumentalist_account(user):
        return frozenset(unprogrammed)
    leads = set(led_project_ids(user, scope='materials'))
    return frozenset(
        unprogrammed
        | {
            pair
            for pair, instrumental in programmed.items()
            if instrumental and pair[0] not in leads
        }
    )


def plan_windows_for_seats(
    rehearsal: Rehearsal, seats: Sequence[Participation],
) -> dict[UUID, PlanWindow | None]:
    """Every called seat's window for ONE evening, in a fixed number of queries.

    The reminder is the only message addressed to one person at a time, so it
    is the only one that can state "your part of the evening" — a broadcast
    cannot personalise. It needs the answer for the whole call at once, which
    `plan_readings_for_user` (one reader, many evenings) cannot give without a
    round of queries per recipient.

    Keyed by participation id; a value of ``None`` is the plan having nothing
    to say about that seat (no plan, or the whole evening). ``seats`` must
    carry `artist` — the voice type is what makes a seat a player's. Blind to
    the publish gate: the caller decides whether a draft may be told.
    """
    items = list(rehearsal.plan_items.all())
    if not items or not seats:
        return {}

    seat_ids = [seat.id for seat in seats]
    piece_ids = {item.piece_id for item in items if item.piece_id}
    lines = plan_lines_for([rehearsal.project_id], piece_ids)
    rows = plan_rows_of(items, lines, rehearsal.project_id)

    cast_lines: dict[UUID, dict[str, str]] = {}
    if piece_ids:
        for participation_id, piece_id, voice_line in ProjectPieceCasting.objects.filter(
            participation_id__in=seat_ids, piece_id__in=piece_ids,
        ).values_list('participation_id', 'piece_id', 'voice_line'):
            _record_cast_line(cast_lines.setdefault(participation_id, {}), str(piece_id), voice_line)

    # A player named on the invited list is called whatever the flag says —
    # the same rule the page reads by, resolved here for the whole call.
    named = set(
        Rehearsal.invited_participations.through.objects.filter(
            rehearsal_id=rehearsal.id, participation_id__in=seat_ids,
        ).values_list('participation_id', flat=True)
    )

    start, end = _wall_clock(rehearsal)
    windows: dict[UUID, PlanWindow | None] = {}
    for seat in seats:
        plan_seat = PlanSeat(
            section_letters=seat.section_letters,
            is_instrumentalist=seat.artist.voice_type == VoiceType.INSTRUMENTALIST,
            cast_lines=cast_lines.get(seat.id, {}),
        )
        calls_players = rehearsal.calls_instrumentalists or seat.id in named
        windows[seat.id] = plan_window_for_seat(
            rows, plan_seat, start=start, end=end, calls_instrumentalists=calls_players,
        )
    return windows


__all__ = [
    "PlanReading",
    "plan_lines_for",
    "plan_readings_for_user",
    "plan_row_context",
    "plan_rows_of",
    "plan_windows_for_seats",
]
