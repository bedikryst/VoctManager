from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from django.db.models import Prefetch, QuerySet

from archive.models import (
    PieceVoiceRequirement,
    ProgramNote,
    Recording,
    ScoreEdition,
    Track,
    Translation,
)
from core.permissions import user_is_manager
from roster.models import (
    Participation,
    PieceReadiness,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    instrumental_item_exists,
    is_instrumentalist_account,
)
from roster.permissions import led_projects_q, user_leads_project

if TYPE_CHECKING:
    from django.contrib.auth.models import User

# Project lifecycle states after which a chorister loses access to a project's
# rehearsal materials — scores in particular, often the conductor's licensed or
# personally-owned property, which must not stay readable once the concert is over.
# Score annotations follow the exact same rule: a shared marking evaporates for a
# singer the moment every project featuring the piece is closed.
#
# The name most callers import; the values live on the model, beside
# `HIDDEN_FROM_CAST_STATUSES`, so the delegation predicates can read the same rule
# without importing this module (which imports them).
CLOSED_PROJECT_STATUSES = Project.CLOSED_STATUSES


def _live_program_items(user: User) -> QuerySet[ProgramItem]:
    """Programme items of every non-closed project the artist holds a live seat
    in, minus the items withheld from THIS reader: a singer is not given an
    instrumental item's music, a player is given everything (they follow the
    whole evening, their own pieces included)."""
    items = ProgramItem.objects.filter(
        project_id__in=Participation.live_seats(artist__user=user).values('project_id'),
    ).exclude(project__status__in=CLOSED_PROJECT_STATUSES)
    if is_instrumentalist_account(user):
        return items
    return items.annotate(instrumental=instrumental_item_exists()).filter(instrumental=False)


def artist_has_live_access_to_piece(user: User, piece_id: uuid.UUID | str | None) -> bool:
    """
    True iff `user` is cast (active participation) in at least one project that
    is still LIVE (not completed/cancelled), programs `piece_id`, and does not
    withhold that item from them.

    This is the single rule behind chorister score, practice-track AND
    annotation access: it evaporates the moment every project featuring the
    piece is closed, so a leaked or bookmarked score URL — or a shared
    conductor marking — stops resolving once the concert is done. It also
    knows whether the reader is a player: an item cast on instrumentalists
    only is the organist's music, not the choir's, and a singer's seat in the
    project does not open it.
    """
    if piece_id is None:
        return False
    return _live_program_items(user).filter(piece_id=piece_id).exists()


def user_has_live_access_to_piece(user: User, piece_id: uuid.UUID | str | None) -> bool:
    """True iff `user` may open this music at all, by either of the two doors.

    A seat in the cast is one (`artist_has_live_access_to_piece`); running one of
    the projects that programme it is the other — a stand-in asked to take an
    evening cannot rehearse a piece they are not allowed to see, and they are
    often not singing in the programme they were handed.

    This is the predicate every "may they read this edition" gate asks. The
    leader MARKING layer is a narrower question with its own scope and is decided
    separately, in `AnnotationViewSet.get_queryset`.
    """
    if piece_id is None:
        return False
    if artist_has_live_access_to_piece(user, piece_id):
        return True
    return (
        ProgramItem.objects
        .filter(
            led_projects_q(user, scope='materials', prefix='project__'),
            piece_id=piece_id,
        )
        .exists()
    )


def user_is_refused_instrumental(user: User, project_id: uuid.UUID | str) -> bool:
    """Whether an instrumental item's music is withheld from this reader in this
    project. Only a singer's seat is ever refused: a manager, a player and
    whoever runs the evening through the materials door see everything. The
    same three exemptions the songbook applies in memory, asked of the
    database for the two book endpoints."""
    return not (
        user_is_manager(user)
        or is_instrumentalist_account(user)
        or user_leads_project(user, project_id, scope='materials')
    )


def artist_live_piece_ids(user: User) -> QuerySet[ProgramItem, uuid.UUID]:
    """
    Distinct ids of every Piece the artist still has live access to (cast in at
    least one non-closed project programming it). Set-form companion to
    `artist_has_live_access_to_piece`, for IN-clause filtering of bulk reads
    (e.g. all shared annotations the singer is allowed to see). Same reader
    rule: a singer's set omits the instrumental items.
    """
    return _live_program_items(user).values_list('piece_id', flat=True).distinct()


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
            # The divisi is not shown to the singer as a list, but it is what
            # NAMES their part: a piece with one tenor line says "Tenor", not
            # "Tenor 1". Without it every casting label would cost a query.
            Prefetch(
                'piece__voice_requirements',
                queryset=PieceVoiceRequirement.objects.filter(is_deleted=False),
                to_attr='prefetched_voice_requirements',
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


def get_artist_materials_queryset(
    user: User, *, include_readiness: bool = True
) -> QuerySet[Participation]:
    """
    CQRS Read Model for the Artist Materials Dashboard.

    Executes a fixed number of SQL queries regardless of data volume by building
    a bounded scope from the user's participations and issuing all subsequent
    fetches as IN-clauses or prefetch batches — no per-row round-trips.

    ``include_readiness=False`` drops the practice-readiness prefetch entirely, so
    those rows never leave the database. The songbook promises the singer that
    their readiness marks are private to them; a manager previewing this same tree
    is served by not fetching them, rather than by a serializer remembering to
    drop them afterwards.

    Returned QuerySet attributes set by this function:
      participation.my_piece_castings   → list[ProjectPieceCasting] (this artist only)
      participation.my_readiness_entries → list[PieceReadiness] (this artist only;
                                          absent when include_readiness is False)
      participation.project.ordered_program → list[ProgramItem]
      program_item.piece.prefetched_tracks  → list[Track]
      program_item.piece.scope_castings     → list[ProjectPieceCasting] (all, across artist's projects)
    """
    # The same seats the schedule is built from, so the songbook and the timeline
    # cannot describe different seasons. Cancellation in particular has to drop the
    # whole card and not merely the score behind it (`CLOSED_PROJECT_STATUSES`
    # already refuses that): a concert absent from the timeline whose programme is
    # still open here is the singer being told two things. The conductor's slice
    # below keeps drafts — they need the tree they are still assembling.
    base_qs: QuerySet[Participation] = Participation.live_seats(artist__user=user)

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

    prefetches: list[Prefetch] = [
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
    ]
    if include_readiness:
        prefetches.append(
            Prefetch(
                'piece_readiness',
                queryset=PieceReadiness.objects.all(),
                to_attr='my_readiness_entries',
            )
        )

    return base_qs.select_related(
        'artist',
        'project__conductor',
        'project__location',
    ).prefetch_related(*prefetches)


def get_led_materials_projects(user: User) -> QuerySet[Project]:
    """
    CQRS Read Model for the "I run this one" slice of the materials dashboard.

    Projects this user leads but is NOT cast in — the sung ones already flow
    through get_artist_materials_queryset() carrying the singer's personalised
    castings and readiness, so excluding them here keeps every project a single
    row. Leading means either holding the podium (Project.conductor) or being
    handed one programme as a stand-in; `led_projects_q` owns that rule,
    including the two different lifecycle gates the two doors use.

    The reader sees the same rich piece tree (scores, tracks, translations,
    recordings, programme notes) with the full project cast, resolved in a fixed
    number of queries. `.distinct()` because the delegation branch traverses a
    multi-valued relation.

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

    led_qs: QuerySet[Project] = (
        Project.objects
        .filter(led_projects_q(user, scope='materials'))
        .exclude(id__in=sung_project_ids)
        .distinct()
    )
    project_ids: list[uuid.UUID] = list(led_qs.values_list('id', flat=True))

    program_items_qs: QuerySet[ProgramItem] = _materials_program_items_prefetch(project_ids)

    return (
        led_qs
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
