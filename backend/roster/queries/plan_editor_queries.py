"""
@file plan_editor_queries.py
@description What the plan editor reads of a project beyond the plan itself,
    as one payload: the programme (what a row can be), the lines each
    programmed piece declares, the cast's voices and the casting board (how
    many people each exclusion chip removes), and the project's evenings with
    their plans, drafts included (what a fill carries over from). A
    projection field by field rather than the list endpoints' serializers:
    seats carry no names, pieces none of the archive's business, evenings no
    debrief, and a field added to a model does not reach this reader until
    somebody adds it here.
@architecture Enterprise SaaS 2026
@module roster/queries/plan_editor_queries
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from archive.models import Piece
from roster.models import (
    Participation,
    ProgramItem,
    ProjectPieceCasting,
    Rehearsal,
)
from roster.serializers import RehearsalPlanItemSerializer

from .plan_queries import plan_row_context

_DATE_TIME = serializers.DateTimeField()


def _optional_id(value: object) -> str | None:
    return str(value) if value is not None else None


def plan_editor_payload(rehearsal: Rehearsal) -> dict[str, Any]:
    """The editor's data for the project ``rehearsal`` belongs to. The caller
    decides who may read it — this answers for anyone it is handed to."""
    project_id = rehearsal.project_id

    programme = list(
        ProgramItem.objects
        .filter(project_id=project_id)
        .select_related('piece')
        .order_by('order')
    )
    pieces = (
        Piece.objects
        .filter(pk__in={item.piece_id for item in programme})
        .prefetch_related('voice_requirements')
        .order_by('title')
    )
    # A seat that turned the project down is called to nothing, so it counts
    # towards no chip.
    seats = list(
        Participation.objects
        .filter(project_id=project_id)
        .exclude(status=Participation.Status.DECLINED)
        .select_related('artist')
    )
    castings = ProjectPieceCasting.objects.filter(
        participation_id__in=[seat.pk for seat in seats],
    )
    evenings = (
        Rehearsal.objects
        .filter(project_id=project_id)
        .prefetch_related('plan_items__piece')
        .order_by('date_time')
    )

    def plan_of(evening: Rehearsal) -> list[dict[str, Any]]:
        items = list(evening.plan_items.all())
        return list(RehearsalPlanItemSerializer(
            items, many=True, context=plan_row_context(evening, items),
        ).data)

    return {
        'rehearsal': str(rehearsal.id),
        'program': [
            {
                'id': str(item.id),
                'piece': str(item.piece_id),
                'piece_title': str(item.piece.title),
                'order': item.order,
                'score_edition': _optional_id(item.score_edition_id),
            }
            for item in programme
        ],
        'pieces': [
            {
                'id': str(piece.id),
                'title': str(piece.title),
                'voice_requirements_read': [
                    {
                        'edition': _optional_id(requirement.edition_id),
                        'voice_line': requirement.voice_line,
                    }
                    for requirement in piece.voice_requirements.all()
                ],
            }
            for piece in pieces
        ],
        'participations': [
            {
                'id': str(seat.id),
                'artist_voice_type': seat.artist.voice_type,
                'default_voice_line': seat.default_voice_line,
            }
            for seat in seats
        ],
        'castings': [
            {
                'participation': str(casting.participation_id),
                'piece': str(casting.piece_id),
                'voice_line': casting.voice_line,
            }
            for casting in castings
        ],
        'rehearsals': [
            {
                'id': str(evening.id),
                # Rendered the way `RehearsalSerializer` renders it: the editor
                # orders these against its own rehearsal's string.
                'date_time': _DATE_TIME.to_representation(evening.date_time),
                'timezone': evening.timezone,
                'focus': evening.focus,
                'plan': plan_of(evening),
            }
            for evening in evenings
        ],
    }
