# roster/invitations.py
# ==========================================
# Publication invitation payload composition
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Builds the metadata behind a PROJECT_INVITATION.

Under the publication model the invitation is the only message a singer receives
before deciding, so it has to carry the whole cost of saying yes: the concert,
the rehearsals they are expected at, the programme, and their own voice line.
An invitation naming only the concert date asks for a commitment whose price is
hidden.

The shared half of that picture (schedule, programme) is identical for the whole
cast, so it is resolved ONCE per publication into a context and reused; only the
personal half (voice lines, and a rehearsal roster restricted to named singers)
is per participation. Composing it naively per artist would issue a fresh set of
queries for every member of a forty-person choir.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from archive.services.voice_scope import voice_scope
from notifications.dtos import InvitationRehearsalMetadata, ProjectInvitationMetadata
from notifications.time_metadata import build_event_time_metadata

from .models import (
    DEFAULT_EVENT_TIMEZONE,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
)
from .score_package_config import resolve_item_edition

logger = logging.getLogger(__name__)


# A rehearsal paired with its own moment. The pair exists so the merge below can
# order by a real datetime — sorting the serialized ISO strings would compare
# offsets as text and misorder a project whose rehearsals straddle a DST change.
_TimedRehearsal = tuple[datetime, InvitationRehearsalMetadata]


@dataclass(frozen=True)
class ProjectInvitationContext:
    """Everything the cast shares, resolved once per publication.

    `rehearsals_for_all` are the rehearsals the whole cast is called to;
    `rehearsals_by_participation` holds the ones restricted to named singers
    (`Rehearsal.invited_participations`), so a sectional never appears in the
    schedule of someone who was not called to it.
    """
    program: tuple[str, ...] = ()
    rehearsals_for_all: tuple[_TimedRehearsal, ...] = ()
    rehearsals_by_participation: dict[UUID, list[_TimedRehearsal]] = field(
        default_factory=dict
    )
    voice_lines_by_participation: dict[UUID, tuple[str, ...]] = field(default_factory=dict)
    # Naming scope for those codes — see `_project_voice_scope`.
    voice_scope: tuple[str, ...] = ()


def _rehearsal_payload(rehearsal: Rehearsal) -> InvitationRehearsalMetadata:
    return InvitationRehearsalMetadata(
        rehearsal_id=rehearsal.id,
        **build_event_time_metadata(
            rehearsal.date_time,
            rehearsal.timezone,
            fallback_timezone=DEFAULT_EVENT_TIMEZONE,
            end=rehearsal.end_date_time,
        ),
        location=rehearsal.location.name if rehearsal.location else "",
        focus=rehearsal.focus or "",
        is_mandatory=rehearsal.is_mandatory,
    )


def build_invitation_context(project: Project) -> ProjectInvitationContext:
    """Resolve the shared and personal facts of a project in a fixed number of queries."""
    program = tuple(
        item.piece.title
        for item in ProgramItem.objects.filter(project=project)
        .select_related("piece")
        .order_by("order")
    )

    shared: list[_TimedRehearsal] = []
    personal: dict[UUID, list[_TimedRehearsal]] = defaultdict(list)
    for rehearsal in (
        Rehearsal.objects.filter(project=project)
        .select_related("location")
        .prefetch_related("invited_participations")
        .order_by("date_time")
    ):
        entry: _TimedRehearsal = (rehearsal.date_time, _rehearsal_payload(rehearsal))
        invited = list(rehearsal.invited_participations.all())
        if not invited:
            shared.append(entry)
            continue
        for participation in invited:
            personal[participation.id].append(entry)

    voice_lines: dict[UUID, list[str]] = defaultdict(list)
    for participation_id, voice_line in (
        ProjectPieceCasting.objects.filter(participation__project=project)
        .order_by("piece__title")
        .values_list("participation_id", "voice_line")
    ):
        if voice_line and voice_line not in voice_lines[participation_id]:
            voice_lines[participation_id].append(voice_line)

    return ProjectInvitationContext(
        program=program,
        rehearsals_for_all=tuple(shared),
        rehearsals_by_participation=dict(personal),
        voice_lines_by_participation={
            key: tuple(value) for key, value in voice_lines.items()
        },
        voice_scope=_project_voice_scope(project),
    )


def _project_voice_scope(project: Project) -> tuple[str, ...]:
    """Every voice line this concert's programme divides into, as codes.

    An invitation names a singer's part before any page of it exists, and it
    names it once for the whole evening — so the scope is the union across the
    programme rather than one piece's divisi. A concert with a single tenor line
    anywhere calls it "Tenor"; one that divides the tenors somewhere keeps the
    index everywhere, which is the honest reading of a mixed programme.
    """
    items = list(
        ProgramItem.objects
        .filter(project=project)
        .select_related("piece")
        .prefetch_related("piece__editions", "piece__voice_requirements")
    )
    # Seats hanging off a soft-deleted participation are off the board, so they
    # must not keep a family numbered: a singer who was removed cannot be the
    # reason everyone else still reads "Tenor 1".
    codes: set[str] = set(
        ProjectPieceCasting.objects
        .filter(participation__project=project, participation__is_deleted=False)
        .values_list("voice_line", flat=True)
    )
    for item in items:
        edition = resolve_item_edition(item)
        codes.update(voice_scope(
            list(item.piece.voice_requirements.all()),
            edition.pk if edition else None,
        ))
    return tuple(sorted(code for code in codes if code))


def build_invitation_metadata(
    participation: Participation,
    context: ProjectInvitationContext | None = None,
) -> dict[str, Any]:
    """Invitation payload for one participation, serialized for the task queue.

    Without a context the payload degrades to the bare facts of the concert —
    which is what an artist added to an already-published project should get,
    since the schedule and programme reach them through the ordinary channels.
    """
    # Blank when unset → the composer falls back to localized neutral copy
    # (e.g. "the management team", and it simply omits a missing venue).
    project = participation.project
    location_name = project.location.name if project.location else ""
    inviter_name = (
        f"{project.conductor.first_name} {project.conductor.last_name}"
        if project.conductor else ""
    )

    event_time_metadata = build_event_time_metadata(
        project.date_time,
        project.timezone,
        fallback_timezone=DEFAULT_EVENT_TIMEZONE,
    )

    call_time_at = ""
    call_time_display = ""
    if project.call_time:
        call_time_metadata = build_event_time_metadata(
            project.call_time,
            project.timezone,
            fallback_timezone=DEFAULT_EVENT_TIMEZONE,
        )
        call_time_at = call_time_metadata["starts_at"]
        call_time_display = call_time_metadata["starts_at_display"]

    rehearsals: tuple[InvitationRehearsalMetadata, ...] = ()
    program: tuple[str, ...] = ()
    voice_lines: tuple[str, ...] = ()
    scope: tuple[str, ...] = ()
    if context is not None:
        program = context.program
        voice_lines = context.voice_lines_by_participation.get(participation.id, ())
        scope = context.voice_scope
        rehearsals = tuple(
            payload
            for _, payload in sorted(
                (
                    *context.rehearsals_for_all,
                    *context.rehearsals_by_participation.get(participation.id, ()),
                ),
                key=lambda entry: entry[0],
            )
        )

    return ProjectInvitationMetadata(
        project_id=participation.project_id,
        project_name=project.title,
        participation_id=participation.id,
        inviter_name=inviter_name,
        **event_time_metadata,
        date_range=event_time_metadata["starts_at_display"],
        location=location_name,
        description=project.description or "",
        call_time_at=call_time_at,
        call_time_display=call_time_display,
        # Both dress codes travel as one line: the roster records no gender, so
        # picking one for the reader would be a guess. Stating both is honest and
        # is how the call sheet already reads.
        dress_code=" · ".join(
            part for part in (project.dress_code_male, project.dress_code_female) if part
        ),
        rehearsals=rehearsals,
        program=program,
        voice_lines=voice_lines,
        voice_scope=scope,
    ).model_dump(mode="json")
