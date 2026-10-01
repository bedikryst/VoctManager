"""
@file permissions.py
@description Who is standing in front of the choir this evening, when it is not
             the conductor. A delegation is a tie to ONE programme, not a rank:
             the predicate for a user and the filter for asking the database the
             same question, so a stand-in cannot be privileged on one screen and
             a stranger on the next. Also which evenings call a stand-in who
             holds no seat, for every audience built from the cast.
@architecture Enterprise SaaS 2026
@module roster/permissions
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal
from uuid import UUID

from django.db.models import OuterRef, Q, QuerySet
from django.utils import timezone

from core.permissions import user_is_manager
from roster.models import (
    Participation,
    ProgramItem,
    Project,
    Rehearsal,
    RehearsalDelegate,
)

if TYPE_CHECKING:
    from django.contrib.auth.models import User

#: What a delegation opens. Five switches rather than one because they leak
#: differently: marks expose the conductor's thinking, the roll call writes other
#: people's records, materials open a programme the stand-in may not be singing
#: in, choir marks put words on every singer's page in the conductor's voice, and
#: managing rehearsals writes and sends the plan of the evenings they lead
#: (`Rehearsal.led_by` picks which) and shows them the programme and the cast's
#: voices the plan is written against. The last two are off by default.
#:
#: ``any`` is a question and not a switch: "does this project exist for this
#: person at all". Every capability needs a project to hang off — a timeline
#: entry, a URL that resolves — and asking `materials` for that made one of the
#: switches a silent prerequisite for the others, so a grant of the roll call
#: alone opened nothing anywhere.
LeadScope = Literal[
    'marks', 'roll_call', 'materials', 'choir_marks', 'manage_rehearsals', 'any',
]

_SCOPE_FIELD: dict[str, str] = {
    'marks': 'can_see_leader_marks',
    'roll_call': 'can_take_roll_call',
    'materials': 'can_open_materials',
    'choir_marks': 'can_mark_for_choir',
    'manage_rehearsals': 'can_manage_led_rehearsals',
}

#: Switches that open nothing on their own. Planning rides on the roll call:
#: without it nobody can name them to lead an evening, and taking it back
#: releases the evenings ahead. Enforced here, in the predicate every reader
#: shares, as well as on save (`RehearsalDelegate.save`), so a row written past
#: the model — a queryset update, a fixture — cannot open the plan either.
_SCOPE_PREREQUISITES: dict[str, tuple[str, ...]] = {
    'manage_rehearsals': ('roll_call',),
}


def _opens_scope(scope: str, rel: str) -> Q:
    """The delegate row's switch for ``scope``, and its prerequisites."""
    opens = Q(**{f'{rel}{_SCOPE_FIELD[scope]}': True})
    for prerequisite in _SCOPE_PREREQUISITES.get(scope, ()):
        opens &= Q(**{f'{rel}{_SCOPE_FIELD[prerequisite]}': True})
    return opens


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
        for each in _SCOPE_FIELD:
            opens_something |= _opens_scope(each, rel)
    else:
        opens_something = _opens_scope(scope, rel)

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


def led_projects_q(
    user: User | OuterRef | None, *, scope: LeadScope, prefix: str = '',
) -> Q:
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

    ``user`` may also be an ``OuterRef`` to a user column, which asks the same
    question once per row of an outer query from inside an ``Exists`` — how
    `messaging.selectors.current_memberships` checks every leader's seat at
    once instead of one user at a time.
    """
    if not isinstance(user, OuterRef) and (
        user is None or not getattr(user, 'is_authenticated', False)
    ):
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


def user_may_plan(user: User | None, rehearsal: Rehearsal) -> bool:
    """Whether ``user`` writes and sends this rehearsal's plan.

    A manager always. The project's conductor (the podium branch of
    `led_projects_q`) for every evening of the programme, the ones he handed
    to an assistant included, since he is the one who handed them. Anybody
    else only for the evening announced for them (`Rehearsal.led_by`), and only
    while their grant on its project carries `manage_rehearsals`: the switch is
    the power, `led_by` only says which evenings. Past evenings included — a
    plan save is silent, and the send refuses a started rehearsal on its own.

    Reads ``rehearsal.project.conductor`` and ``rehearsal.led_by``: select
    them with the rehearsal.
    """
    if user_is_manager(user):
        return True
    if user is None:
        return False
    conductor = rehearsal.project.conductor
    on_podium = (
        conductor is not None and not conductor.is_deleted and conductor.user_id == user.pk
    )
    led_by = rehearsal.led_by
    announced = led_by is not None and led_by.user_id == user.pk
    if not (on_podium or announced):
        return False
    return user_leads_project(user, rehearsal.project_id, scope='manage_rehearsals')


# ── The leader without a seat ──────────────────────────────────────────────── #
# An assistant may run a programme they do not sing in. They are told what the
# cast is told about the evenings that call them, without becoming a seat: a
# Participation would put them in the roll call, the casting board, the plan's
# seat chips, the fees and the contracts. Every audience built from the cast —
# the announcement queue, a rehearsal's and a project's cancellation, the
# day-before reminder, the subscribed calendar — adds them through the readers
# below, so the rule is written once.
#
# The evenings that call them are the ones announced for them (`Rehearsal.led_by`)
# and every whole-cast evening. A sectional somebody else leads stays on their
# timeline as something to browse, never as a call: their own voice type does
# not seat them in a section of a programme they do not sing.


def _calls_whole_cast(rehearsal: Rehearsal) -> bool:
    """No named list and no section rule — read as `called_participations`
    reads it, since every audience this joins starts from that set."""
    return (
        not rehearsal.called_sections
        and not rehearsal.invited_participations.filter(is_deleted=False).exists()
    )


def seatless_leader_user_ids(
    project: Project,
    *,
    rehearsal: Rehearsal | None = None,
    closed_too: bool = False,
) -> list[str]:
    """Who leads ``project`` without a seat in it, as the user ids the
    notification layer addresses; with ``rehearsal``, only those that evening
    calls.

    A leader is a live grant of any scope (`live_delegate_q`). A seat of their
    own, declined excepted, takes them out: the seat already reaches them by
    the cast's rule, and a second path would tell them everything twice. The
    project's conductor is not a grant and is not asked here.

    A closed project has ended every grant (`led_projects_q`) and reaches
    nobody, unless ``closed_too`` — for the one message sent the moment it
    closes, its cancellation. Drafts are the caller's to withhold, as they are
    for the cast.
    """
    if project.status in Project.CLOSED_STATUSES and not closed_too:
        return []
    seated = (
        Participation.objects
        .filter(project=project, is_deleted=False)
        .exclude(status=Participation.Status.DECLINED)
        .values('artist_id')
    )
    grants = (
        RehearsalDelegate.objects
        .filter(live_delegate_q(scope='any'), project=project, artist__user__isnull=False)
        .exclude(artist_id__in=seated)
    )
    if rehearsal is not None and not _calls_whole_cast(rehearsal):
        if rehearsal.led_by_id is None:
            return []
        grants = grants.filter(artist_id=rehearsal.led_by_id)
    return sorted({str(user_id) for user_id in grants.values_list('artist__user_id', flat=True)})


def seatless_led_project_ids(user: User | None) -> QuerySet[Project, UUID]:
    """Ids of the projects ``user`` leads without a seat — the projects
    `seatless_leader_user_ids` names them in. Drafts included, as in
    `led_projects_q`; closed projects not."""
    if user is None or not getattr(user, 'is_authenticated', False):
        return Project.objects.none().values_list('id', flat=True)
    seated = (
        Participation.objects
        .filter(artist__user=user, is_deleted=False)
        .exclude(status=Participation.Status.DECLINED)
        .values('project_id')
    )
    return (
        Project.objects
        .filter(
            Q(rehearsal_delegates__artist__user=user)
            & live_delegate_q(scope='any', rel='rehearsal_delegates__')
        )
        .exclude(status__in=Project.CLOSED_STATUSES)
        .exclude(id__in=seated)
        .values_list('id', flat=True)
        .distinct()
    )


def seatless_leader_calling_q(user: User | None) -> Q:
    """The `Rehearsal` rows that call ``user`` as a leader without a seat —
    `seatless_leader_user_ids` asked from the leader's side, for the calendar
    feed. The whole-cast half mirrors `Rehearsal.calling_q`'s tutti branch.
    Traverses ``invited_participations``: the queryset needs ``.distinct()``."""
    return Q(project_id__in=seatless_led_project_ids(user)) & (
        Q(led_by__user=user)
        | Q(invited_participations__isnull=True, called_sections='')
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
