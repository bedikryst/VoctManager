"""
@file permissions.py
@description Who is standing in front of the choir this evening, when it is not
             the conductor. A delegation is a tie to ONE programme, not a rank:
             the predicate for a user and the filter for asking the database the
             same question, so a stand-in cannot be privileged on one screen and
             a stranger on the next.
@architecture Enterprise SaaS 2026
@module roster/permissions
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal
from uuid import UUID

from django.db.models import Q, QuerySet
from django.utils import timezone

from roster.models import ProgramItem, Project

if TYPE_CHECKING:
    from django.contrib.auth.models import User

#: What a delegation opens. Four switches rather than one because they leak
#: differently: marks expose the conductor's thinking, the roll call writes other
#: people's records, materials open a programme the stand-in may not be singing
#: in, and choir marks put words on every singer's page in the conductor's voice
#: (the only switch that is off by default).
#:
#: ``any`` is a question and not a switch: "does this project exist for this
#: person at all". Every capability needs a project to hang off — a timeline
#: entry, a URL that resolves — and asking `materials` for that made one of the
#: switches a silent prerequisite for the others, so a grant of the roll call
#: alone opened nothing anywhere.
LeadScope = Literal['marks', 'roll_call', 'materials', 'choir_marks', 'any']

_SCOPE_FIELD: dict[str, str] = {
    'marks': 'can_see_leader_marks',
    'roll_call': 'can_take_roll_call',
    'materials': 'can_open_materials',
    'choir_marks': 'can_mark_for_choir',
}


def live_delegate_q(*, scope: LeadScope, rel: str = '') -> Q:
    """A ``RehearsalDelegate`` row that currently opens ``scope``: not revoked,
    its artist not deleted, its clock not run out, and at least the asked-for
    switch on.

    ``rel`` is the lookup path from the queryset's model to the delegate row —
    ``''`` when filtering ``RehearsalDelegate`` itself, ``'rehearsal_delegates__'``
    from a Project. The row-level half of `led_projects_q`, split out so the
    project's own "who leads this" fact and the permission predicate cannot
    disagree about which rows count. Says nothing about the PROJECT's status:
    that is the caller's question (a closed project ends every grant for the
    permission, but is still led by whoever led it as a fact).
    """
    if scope == 'any':
        opens_something = Q()
        for scope_field in _SCOPE_FIELD.values():
            opens_something |= Q(**{f'{rel}{scope_field}': True})
    else:
        opens_something = Q(**{f'{rel}{_SCOPE_FIELD[scope]}': True})

    return (
        Q(**{
            f'{rel}artist__is_deleted': False,
            f'{rel}is_deleted': False,
        })
        & opens_something
        # Read at call time, never at import: a Q built once at module scope
        # would freeze "now" on the moment the process started, and a grant that
        # expired days ago would keep opening the score until the next deploy.
        & (
            Q(**{f'{rel}expires_at__isnull': True})
            | Q(**{f'{rel}expires_at__gt': timezone.now()})
        )
    )


def led_projects_q(user: User | None, *, scope: LeadScope, prefix: str = '') -> Q:
    """Projects ``user`` runs, as a filter against a relation reaching Project.

    ``prefix`` is the lookup path from the queryset's model to Project — ``''``
    when filtering Project itself, ``'project__'`` from a ProgramItem, a
    Rehearsal or an Attendance's rehearsal. One builder for every caller, so the
    rule is written once and the screens cannot disagree about who leads what.

    Two branches, with deliberately different lifecycle rules:

    * an explicit ``RehearsalDelegate`` row, live and unexpired, on a project
      that has not closed. A grant is a favour for an upcoming evening, so it
      ends when the music does — drafts are included, because the grant names
      one person on purpose and is not the casting-derived access that
      ``HIDDEN_FROM_CAST_STATUSES`` exists to withhold.
    * ``Project.conductor``, on the same terms the conductor's own materials
      dashboard already uses (drafts stay, a cancellation does not). Matching it
      is the point: the podium and the music must not disagree about which
      projects are theirs.

    ``scope`` narrows the delegated branch to grants that actually carry that
    power; the podium branch carries all of them and is never narrowed. Ask
    ``'any'`` when the question is only whether the project exists for this
    person, and the specific scope wherever the capability itself is exercised.

    Returns a Q that traverses a MULTI-VALUED relation, so every queryset built
    with it needs ``.distinct()`` — a project with two delegate rows would
    otherwise arrive twice.

    An anonymous or absent user matches nothing rather than everything.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return Q(pk__in=[])

    p = prefix
    rel = f'{p}rehearsal_delegates__'

    # Every condition below is in ONE filter() call, so they all bind to the same
    # delegation row — including the scope disjunction inside `live_delegate_q`,
    # which is why a grant with every switch off (reachable through the API, not
    # through the form) still opens nothing.
    delegated = (
        Q(**{f'{rel}artist__user': user})
        & live_delegate_q(scope=scope, rel=rel)
        & ~Q(**{f'{p}status__in': Project.CLOSED_STATUSES})
    )
    conducted = (
        Q(**{
            f'{p}conductor__user': user,
            f'{p}conductor__is_deleted': False,
        })
        & ~Q(**{f'{p}status': Project.Status.CANCELLED})
    )
    return delegated | conducted


def led_project_ids(user: User | None, *, scope: LeadScope) -> QuerySet[Project, UUID]:
    """Ids of the projects ``user`` runs — set-form companion to `led_projects_q`,
    for IN-clause filtering and for widening a queryset that is already scoped."""
    return (
        Project.objects
        .filter(led_projects_q(user, scope=scope))
        .values_list('id', flat=True)
        .distinct()
    )


def user_leads_project(
    user: User | None,
    project_id: UUID | str | None,
    *,
    scope: LeadScope,
) -> bool:
    """True iff ``user`` runs that one project in that one respect."""
    if project_id is None:
        return False
    return (
        Project.objects
        .filter(led_projects_q(user, scope=scope), pk=project_id)
        .exists()
    )


def led_piece_ids(user: User | None, *, scope: LeadScope) -> QuerySet[ProgramItem, UUID]:
    """Distinct ids of every Piece programmed by a project ``user`` runs.

    The leader-layer counterpart of `artist_live_piece_ids`: markings hang off
    editions, editions off pieces, and a piece reaches a stand-in through the
    programme of the project they were handed — the same path a singer's own
    access walks, entered through a different door.

    ``scope`` is not decoration. ``marks`` answers "may they read the leader
    layer on this music", ``materials`` answers "may they open this music at
    all" — a delegation can carry either without the other.
    """
    return (
        ProgramItem.objects
        .filter(led_projects_q(user, scope=scope, prefix='project__'))
        .values_list('piece_id', flat=True)
        .distinct()
    )
