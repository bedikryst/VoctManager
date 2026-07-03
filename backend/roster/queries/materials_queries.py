from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from django.db.models import Prefetch, QuerySet

from archive.models import (
    ProgramNote,
    Recording,
    ScoreEdition,
    Track,
    Translation,
)
from roster.models import (
    Participation,
    PieceReadiness,
    ProgramItem,
    Project,
    ProjectPieceCasting,
)

if TYPE_CHECKING:
    from django.contrib.auth.models import User

# Project lifecycle states after which a chorister loses access to a project's
# rehearsal materials — scores in particular, often the conductor's licensed or
# personally-owned property, which must not stay readable once the concert is over.
# Score annotations follow the exact same rule: a shared marking evaporates for a
# singer the moment every project featuring the piece is closed.
CLOSED_PROJECT_STATUSES = (Project.Status.COMPLETED, Project.Status.CANCELLED)


def artist_has_live_access_to_piece(user: User, piece_id: uuid.UUID | str | None) -> bool:
    """
    True iff `user` is cast (active participation) in at least one project that
    is still LIVE (not completed/cancelled) and programs `piece_id`.

    This is the single rule behind chorister score AND annotation access: it
    evaporates the moment every project featuring the piece is closed, so a
    leaked or bookmarked score URL — or a shared conductor marking — stops
    resolving once the concert is done.
    """
    if piece_id is None:
        return False
    return (
        Participation.objects.filter(
            artist__user=user,
            is_deleted=False,
            project__program_items__piece_id=piece_id,
        )
        .exclude(project__status__in=CLOSED_PROJECT_STATUSES)
        .exists()
    )


def artist_live_piece_ids(user: User) -> QuerySet[ProgramItem, uuid.UUID]:
    """
    Distinct ids of every Piece the artist still has live access to (cast in at
    least one non-closed project programming it). Set-form companion to
    `artist_has_live_access_to_piece`, for IN-clause filtering of bulk reads
    (e.g. all shared annotations the singer is allowed to see).
    """
    return (
        ProgramItem.objects.filter(
            project__participations__artist__user=user,
            project__participations__is_deleted=False,
        )
        .exclude(project__status__in=CLOSED_PROJECT_STATUSES)
        .values_list('piece_id', flat=True)
        .distinct()
    )


def _materials_program_items_prefetch(
    project_ids: list[uuid.UUID],
) -> QuerySet[ProgramItem]:
    """
    Program-items queryset with the full piece materials tree pre-joined —
    tracks, castings (scoped to ``project_ids`` to prevent cross-tenant leakage),
    translations, recordings, programme notes and ScoreEdition PDFs. Shared by
    the singer and conductor materials read models so both resolve in a fixed
    number of queries. Sets on each program_item.piece:
      prefetched_tracks / scope_castings / prefetched_translations /
      prefetched_recordings / prefetched_program_notes / prefetched_editions.
    """
    castings_in_scope_qs: QuerySet[ProjectPieceCasting] = (
        ProjectPieceCasting.objects
        .filter(
            participation__project_id__in=project_ids,
            participation__is_deleted=False,
        )
        .select_related('participation__artist')
    )

    return (
        ProgramItem.objects
        .select_related('piece__composer')
        .prefetch_related(
            Prefetch(
                'piece__tracks',
                queryset=Track.objects.filter(is_deleted=False),
                to_attr='prefetched_tracks',
            ),
            Prefetch(
                'piece__castings',
                queryset=castings_in_scope_qs,
                to_attr='scope_castings',
            ),
            # Score Compiler enrichments — same prefetch pattern, soft-delete
            # safe via the default manager. Used by PieceMaterialsSerializer
            # to surface IPA, multi-language translations, AI program notes,
            # canonical recordings and ScoreEdition PDFs to the choir.
            Prefetch(
                'piece__translations',
                queryset=Translation.objects.filter(is_deleted=False),
                to_attr='prefetched_translations',
            ),
            Prefetch(
                'piece__recordings',
                queryset=Recording.objects.filter(is_deleted=False),
                to_attr='prefetched_recordings',
            ),
            Prefetch(
                'piece__program_notes',
                queryset=ProgramNote.objects.filter(is_deleted=False),
                to_attr='prefetched_program_notes',
            ),
            Prefetch(
                'piece__editions',
                queryset=ScoreEdition.objects.filter(is_deleted=False),
                to_attr='prefetched_editions',
            ),
        )
        .order_by('order')
    )


def get_artist_materials_queryset(user: User) -> QuerySet[Participation]:
    """
    CQRS Read Model for the Artist Materials Dashboard.

    Executes a fixed number of SQL queries regardless of data volume by building
    a bounded scope from the user's participations and issuing all subsequent
    fetches as IN-clauses or prefetch batches — no per-row round-trips.

    Returned QuerySet attributes set by this function:
      participation.my_piece_castings   → list[ProjectPieceCasting] (this artist only)
      participation.my_readiness_entries → list[PieceReadiness] (this artist only)
      participation.project.ordered_program → list[ProgramItem]
      program_item.piece.prefetched_tracks  → list[Track]
      program_item.piece.scope_castings     → list[ProjectPieceCasting] (all, across artist's projects)
    """
    base_qs: QuerySet[Participation] = Participation.objects.filter(
        artist__user=user,
        is_deleted=False,
    )

    # Materialise once: used to build bounded sub-queries.
    # Typical cardinality is <50, so the IN-clause is cheap.
    project_ids: list[uuid.UUID] = list(base_qs.values_list('project_id', flat=True))

    # Only THIS artist's own castings — for the personalised "my_casting" field.
    my_castings_qs: QuerySet[ProjectPieceCasting] = (
        ProjectPieceCasting.objects
        .filter(participation__in=base_qs)
        .select_related('participation__artist')
    )

    program_items_qs: QuerySet[ProgramItem] = _materials_program_items_prefetch(project_ids)

    return base_qs.select_related(
        'artist',
        'project__conductor',
        'project__location',
    ).prefetch_related(
        Prefetch(
            'project__program_items',
            queryset=program_items_qs,
            to_attr='ordered_program',
        ),
        Prefetch(
            'castings',
            queryset=my_castings_qs,
            to_attr='my_piece_castings',
        ),
        Prefetch(
            'piece_readiness',
            queryset=PieceReadiness.objects.all(),
            to_attr='my_readiness_entries',
        ),
    )


def get_conductor_materials_projects(user: User) -> QuerySet[Project]:
    """
    CQRS Read Model for the conductor's slice of the materials dashboard.

    Projects this user conducts (Project.conductor → Artist → user) but is NOT
    cast in — the sung ones already flow through get_artist_materials_queryset()
    carrying the singer's personalised castings and readiness, so excluding them
    here keeps every project a single row. The conductor sees the same rich
    piece tree (scores, tracks, translations, recordings, programme notes) with
    the full project cast, resolved in a fixed number of queries.

    Returned QuerySet attributes set by this function:
      project.ordered_program              → list[ProgramItem]
      program_item.piece.prefetched_tracks → list[Track]
      program_item.piece.scope_castings    → list[ProjectPieceCasting] (full cast)
    """
    sung_project_ids: QuerySet[Participation, uuid.UUID] = (
        Participation.objects
        .filter(artist__user=user, is_deleted=False)
        .values_list('project_id', flat=True)
    )

    conducted_qs: QuerySet[Project] = (
        Project.objects
        .filter(conductor__user=user, conductor__is_deleted=False)
        .exclude(id__in=sung_project_ids)
    )
    project_ids: list[uuid.UUID] = list(conducted_qs.values_list('id', flat=True))

    program_items_qs: QuerySet[ProgramItem] = _materials_program_items_prefetch(project_ids)

    return (
        conducted_qs
        .select_related('conductor', 'location')
        .prefetch_related(
            Prefetch(
                'program_items',
                queryset=program_items_qs,
                to_attr='ordered_program',
            ),
        )
        .order_by('date_time')
    )
