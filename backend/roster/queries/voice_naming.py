"""Project-scoped voice-line naming for the aggregate read models.

[core.voice_labels] decides HOW a line is named; this decides WHAT the reader
is looking at when a concert is in hand. The scope of one seat is the divisi of
the arrangement that concert binds, widened by every line actually cast on the
piece there — so the dossier, the call sheet and the casting board can never
disagree about whether a part is "Tenor" or "Tenor 1".

Aggregate surfaces hold (project, piece) pairs by the hundred, so the whole set
is resolved in three queries rather than three per pair.
"""

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from archive.models import PieceVoiceRequirement
from archive.services.voice_scope import voice_labels
from roster.models import ProgramItem, ProjectPieceCasting
from roster.score_package_config import resolve_item_edition


def project_voice_labels(
    pairs: Iterable[tuple[UUID, UUID]],
) -> dict[tuple[UUID, UUID], dict[str, str]]:
    """(project_id, piece_id) → voice code → display name.

    A pair whose piece is no longer on the programme still resolves — against
    the piece-wide divisi plus whoever is cast — because a past concert's
    record must keep naming the part it was sung as.
    """
    keys = {(project_id, piece_id) for project_id, piece_id in pairs}
    if not keys:
        return {}

    project_ids = {project_id for project_id, _ in keys}
    piece_ids = {piece_id for _, piece_id in keys}

    bound_edition: dict[tuple[UUID, UUID], UUID | None] = {}
    for item in (
        ProgramItem.objects
        .filter(project_id__in=project_ids, piece_id__in=piece_ids)
        .select_related('piece')
        .prefetch_related('piece__editions')
    ):
        edition = resolve_item_edition(item)
        bound_edition[(item.project_id, item.piece_id)] = edition.pk if edition else None

    requirements: dict[UUID, list[PieceVoiceRequirement]] = {}
    for requirement in PieceVoiceRequirement.objects.filter(piece_id__in=piece_ids):
        requirements.setdefault(requirement.piece_id, []).append(requirement)

    # Seats on a soft-deleted participation are gone from the concert, so they
    # must not be the reason a family stays numbered for everyone else.
    cast_codes: dict[tuple[UUID, UUID], set[str]] = {}
    for project_id, piece_id, code in (
        ProjectPieceCasting.objects
        .filter(
            participation__project_id__in=project_ids,
            piece_id__in=piece_ids,
            participation__is_deleted=False,
        )
        .values_list('participation__project_id', 'piece_id', 'voice_line')
    ):
        cast_codes.setdefault((project_id, piece_id), set()).add(code)

    return {
        key: voice_labels(
            requirements.get(key[1], []),
            bound_edition.get(key),
            extra_codes=cast_codes.get(key, ()),
        )
        for key in keys
    }
