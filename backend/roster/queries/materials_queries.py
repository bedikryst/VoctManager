from __future__ import annotations

import uuid

from django.contrib.auth.base_user import AbstractBaseUser
from django.db.models import Prefetch, QuerySet

from archive.models import Track
from roster.models import Participation, ProgramItem, ProjectPieceCasting


def get_artist_materials_queryset(user: AbstractBaseUser) -> QuerySet[Participation]:
    """
    CQRS Read Model for the Artist Materials Dashboard.

    Executes a fixed number of SQL queries regardless of data volume by building
    a bounded scope from the user's participations and issuing all subsequent
    fetches as IN-clauses or prefetch batches — no per-row round-trips.

    Returned QuerySet attributes set by this function:
      participation.my_piece_castings   → list[ProjectPieceCasting] (this artist only)
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

    # All castings within the artist's project scope — prevents cross-tenant data leakage.
    # Used to populate piece.scope_castings; the serializer slices by project_id in Python.
    castings_in_scope_qs: QuerySet[ProjectPieceCasting] = (
        ProjectPieceCasting.objects
        .filter(
            participation__project_id__in=project_ids,
            participation__is_deleted=False,
        )
        .select_related('participation__artist')
    )

    # Only THIS artist's own castings — for the personalised "my_casting" field.
    my_castings_qs: QuerySet[ProjectPieceCasting] = (
        ProjectPieceCasting.objects
        .filter(participation__in=base_qs)
        .select_related('participation__artist')
    )

    program_items_qs: QuerySet[ProgramItem] = (
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
        )
        .order_by('order')
    )

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
    )
