"""
@file announcement_queue.py
@description The announcement queue for a live project: where a change waits
             between being saved and being told.

             On an ACTIVE project the write and the announcement are separate
             acts. The write lands at once — an artist opening the app always
             sees current data — while what the cast would be *told* accrues here
             until the conductor publishes it. That is what turns five rehearsal
             edits into one piece of news, and what makes a typo corrected a
             minute later reach nobody at all.

             Publication folds twice. **Collapsing** reduces the rows to what
             actually changed — one message per subject, corrections cancelled
             out. **Planning** then reduces that to what each person receives:
             someone with several pieces of news gets one composite briefing
             rather than one message per change, which is what turns five
             rehearsals across twelve singers into twelve e-mails instead of
             sixty. Someone with a single piece of news still gets its own
             message, because it names what happened better than a briefing
             wrapping one line.

             This module is the mechanism: enqueue, collapse, plan, publish,
             discard. The decision of what queues versus what goes out
             immediately lives one level up, in announcements.py; how a briefing
             reads lives in message_content.py.

@architecture Enterprise SaaS 2026
@module notifications/announcement_queue
"""
from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import partial
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import transaction
from django.db.models import Min, Q
from django.utils import timezone

from .models import (
    AnnouncementKind,
    AnnouncementSubject,
    NotificationLevel,
    NotificationType,
    PendingAnnouncement,
)
from .services import NotificationRecipientPolicy
from .tasks import send_bulk_notifications_task, send_notification_task

if TYPE_CHECKING:
    from roster.models import Project

logger = logging.getLogger(__name__)

# Ranks the levels so a collapsed announcement can take the loudest row that
# survived. Purely an ordering — the levels themselves live on the model.
_LEVEL_RANK: dict[str, int] = {
    NotificationLevel.INFO: 0,
    NotificationLevel.WARNING: 1,
    NotificationLevel.URGENT: 2,
}

# One rule for every field diff the queue carries: a change to *when* people have
# to be somewhere is the only kind that earns the alarm channel. Held here rather
# than per emitter so the escalation cannot drift between projects and rehearsals,
# and so it stays correct after collapsing — a reschedule that reverts loses its
# urgency along with its row.
#
# The warm-up and the sound check are hours too, and they are deliberately NOT
# here: the call time is the hour the cast is held to, and it does not move when
# a window inside the day does. A singer who is told to be there at 17:00 is
# still due at 17:00 after the sound check slides — so that news travels as news,
# not as an alarm.
_TIME_CRITICAL_FIELDS = frozenset({"date_time", "call_time"})

# The diff lives in dedicated columns, so it is stripped from the stored metadata
# and rebuilt from the surviving rows at publish time.
_DIFF_KEY = "changes"

# The calendar payload is per *message*, not per change: a briefing announcing
# five rehearsals lifts their events out of the individual payloads and attaches
# one multi-event .ics instead of five invites.
_CALENDAR_KEY = "ics"

# Subjects that are published on their own even when the recipient has other news
# waiting. Being taken off a cast is a personal message about leaving; folding it
# into "what's new in Requiem" would file it under a project the reader is no
# longer part of.
_STANDALONE_SUBJECTS = frozenset({AnnouncementSubject.PARTICIPATION})


def _fuse(level: str) -> timedelta:
    """How long a queue at this urgency may sit before the sweep says so.

    Two fuses, because the cost of silence is not the same for every kind of news.
    A dress code can wait for the conductor's next sitting; a change to *when*
    people have to be somewhere stops being useful the moment they have left for
    the old time, and a flat day-long fuse would routinely fire after the
    rehearsal it was about. That is the same rule `_TIME_CRITICAL_FIELDS` applies
    at enqueue, read here through the level it produced.

    Settings-overridable so the sweep can be exercised without manufacturing a day.
    """
    hours = (
        settings.ANNOUNCEMENT_NUDGE_URGENT_HOURS
        if level == NotificationLevel.URGENT
        else settings.ANNOUNCEMENT_NUDGE_HOURS
    )
    return timedelta(hours=hours)


@dataclass(frozen=True)
class ResolvedAnnouncement:
    """One message the queue would send, after collapsing.

    `recipient_id` is None for a broadcast — its audience is deliberately not
    fixed here, so someone who confirms between the edit and the publication is
    still reached.
    """
    recipient_id: str | None
    subject_type: str
    subject_id: str
    kind: str
    notification_type: str
    level: str
    metadata: dict[str, Any]
    row_ids: tuple[str, ...]


@dataclass(frozen=True)
class QueuedChange:
    """One line of the conductor's review sheet.

    A line is the unit the surface offers: it is what the sheet renders, what a
    checkbox holds back, and the smallest thing that is independently meaningful.
    It is finer than a message — a project diff becomes one line per field, so the
    venue can go out while a still-unsettled call time waits — and never coarser:
    a creation, a removal or a rehearsal's whole diff is one indivisible piece of
    news, and splitting it would publish half a fact.

    `metadata` is the payload the emitter built, so the sheet renders each line
    from exactly the facts the artist's own message will carry.
    """
    id: str
    row_ids: tuple[str, ...]
    subject_type: str
    subject_id: str
    kind: str
    notification_type: str
    level: str
    # The single field this line reports, when it is one line of a wider diff.
    # Empty for anything indivisible.
    field: str
    metadata: dict[str, Any]
    recipient_count: int
    # Named only for a personal line — the sheet has to say *whose* part moved, and
    # above all who is about to be told they are off the cast.
    recipient_name: str
    # Held back by the conductor (or by the rule below that holds a whole subject
    # when its creation is held). The row stays pending; nothing is discarded.
    is_held: bool


@dataclass
class PublicationPlan:
    """The queue resolved down to the individual messages it would send.

    Collapsing answers "what changed"; this answers "who gets how many envelopes",
    which is a different question and the one the headline number is about. Every
    announcement is assigned to exactly one of three fates, and a recipient appears
    in exactly one of the last two:

      • **standalone** — published on its own regardless of what else is waiting.
      • **solo** — the recipient's only piece of news, so they get that event's own
        message, which says more precisely what happened than a briefing would.
      • **briefings** — a recipient with more than one, folded into one message.

    Built by the same code that publishes, so the count the conductor is shown and
    the fan-out that follows can never disagree.
    """
    announcements: list[ResolvedAnnouncement]
    # Parallel to `announcements`: who each one reaches, resolved now.
    audiences: list[list[str]]
    standalone: list[int]
    solo: dict[int, list[str]]
    briefings: dict[str, list[int]]

    @property
    def message_count(self) -> int:
        """How many messages actually leave — counted in envelopes, not events.

        A broadcast that nobody folds is one *announcement* but one message per
        person in its audience: a rehearsal moved on a twelve-singer cast is twelve
        e-mails and twelve pushes. Counting the announcement instead would put "1"
        on the conductor's confirm button while twelve people are written to, which
        is the one number this whole feature exists to make honest.
        """
        return (
            sum(len(self.audiences[index]) for index in self.standalone)
            + sum(len(recipient_ids) for recipient_ids in self.solo.values())
            + len(self.briefings)
        )

    @property
    def recipient_ids(self) -> set[str]:
        reached: set[str] = set(self.briefings)
        for index in self.standalone:
            reached.update(self.audiences[index])
        for recipient_ids in self.solo.values():
            reached.update(recipient_ids)
        return reached


@dataclass(frozen=True)
class StaleQueue:
    """A project's queue that has been waiting longer than its fuse allows.

    The counts are the ones the conductor already reads elsewhere:
    `change_count` is what the hub's pill shows and `recipient_count` is how many
    people are in the dark. Both come from `preview`, so a nudge can never quote a
    number the review sheet then contradicts — and so does `waiting_since`, which
    dates the news rather than the rows behind it.

    `fuse` travels with the rest so the dispatcher can re-check the cooldown as it
    claims the project, rather than trusting the read that produced this.
    """
    project: Project
    waiting_since: datetime
    level: str
    fuse: timedelta
    change_count: int
    recipient_count: int


def _group_key(row: PendingAnnouncement) -> tuple[str | None, str, str]:
    """How collapsing groups a row: everything the queue holds about one thing,
    addressed to one person."""
    return (
        str(row.recipient_id) if row.recipient_id else None,
        row.subject_type,
        row.subject_id,
    )


def _line_id(recipient_id: str | None, subject_type: str, subject_id: str, field: str) -> str:
    """Stable identity for one review-sheet line, derived rather than stored.

    It has to survive a refetch — the conductor's selection is held against these
    ids while the sheet recomputes its counts — so it is composed from the row's
    own coordinates instead of a row id, which a later edit to the same field would
    change underneath the selection.
    """
    return f"{subject_type}:{subject_id}:{recipient_id or '*'}:{field or '~'}"


def _partition(
    rows: Sequence[PendingAnnouncement], exclude: Iterable[str]
) -> tuple[list[PendingAnnouncement], set[str]]:
    """Split the pending rows into what this publication takes and what it holds.

    Holding is not discarding: a held row stays pending and turns up in the next
    review, collapsed against anything that happened to it meanwhile. That is the
    reversible reading of an unticked box, and the reason the sheet needs no second
    per-line verb — publishing the rest leaves exactly the held rows behind, which
    a single "discard" then drops.

    One rule beyond the literal selection: **holding a creation holds everything
    about that subject.** Otherwise excluding "new rehearsal" while keeping the
    change that followed it would announce a move to a rehearsal the cast has never
    been told exists — the same invariant collapsing already applies to a subject
    born and removed inside one window. The sheet cannot express that selection,
    but the endpoint takes row ids from a client, and this is the failure it must
    not allow.
    """
    excluded = {str(value) for value in exclude}
    if not excluded:
        return list(rows), set()

    held_subjects = {
        _group_key(row)
        for row in rows
        if str(row.id) in excluded and row.kind == AnnouncementKind.CREATED
    }

    taken: list[PendingAnnouncement] = []
    held: set[str] = set()
    for row in rows:
        if str(row.id) in excluded or _group_key(row) in held_subjects:
            held.add(str(row.id))
        else:
            taken.append(row)
    return taken, held


def _freshened(base: dict[str, Any], latest: dict[str, Any]) -> dict[str, Any]:
    """Bring a creation's payload up to date without changing its shape.

    A rehearsal scheduled for 19:00 and then moved to 19:30 before anyone was
    told is a rehearsal at 19:30 — announcing the stored 19:00 and then a change
    to it would be exactly the noise this queue exists to remove. Only keys the
    creation already carries are overwritten, so a later payload can never
    introduce a field the creation's composer does not expect; the diff is
    excluded outright, because a creation has nothing to diff against.
    """
    return {
        **base,
        **{key: value for key, value in latest.items() if key in base and key != _DIFF_KEY},
    }


def _collapse_changes(
    diffs: Sequence[PendingAnnouncement],
) -> tuple[list[dict[str, str | None]], set[str]]:
    """Fold a subject's field diffs into what actually changed.

    Per field: the earliest `old` against the latest `new`. A field that ends
    where it started is dropped — that is the typo-and-fix case disappearing
    instead of shipping as an alarm.

    Label-only changes (the run sheet, a conductor swap, a rehearsal becoming
    mandatory) carry no values by construction, so they would read as unchanged
    under that test; they are recognised by both sides being absent and always
    survive.
    """
    by_field: dict[str, list[PendingAnnouncement]] = {}
    for row in diffs:
        by_field.setdefault(row.change_field, []).append(row)

    changes: list[dict[str, str | None]] = []
    surviving: set[str] = set()
    for field_key, rows in by_field.items():
        old, new = rows[0].change_old, rows[-1].change_new
        label_only = all(row.change_old is None and row.change_new is None for row in rows)
        if not label_only and old == new:
            continue
        changes.append({"field": field_key, "old": old, "new": new})
        surviving.add(field_key)
    return changes, surviving


def _collapse_group(
    recipient_id: str | None,
    subject_type: str,
    subject_id: str,
    group: Sequence[PendingAnnouncement],
) -> ResolvedAnnouncement | None:
    """Reduce every pending row about one subject to at most one message.

    A lifecycle step restates the whole subject, so where the rows end decides
    the message: still there means one creation (brought up to date), gone means
    one removal, neither means the field-level fold below. A subject that was
    both born and removed inside this window resolves to silence — the cast was
    never told it existed.
    """
    row_ids = tuple(str(row.id) for row in group)
    # The subject predates the queue unless the first thing recorded about it is
    # its creation — which is what makes its removal news or not.
    born_here = group[0].kind == AnnouncementKind.CREATED
    lifecycle = [row for row in group if row.kind != AnnouncementKind.CHANGED]
    final = lifecycle[-1] if lifecycle else None

    if final is not None and final.kind == AnnouncementKind.REMOVED:
        if born_here:
            return None
        return ResolvedAnnouncement(
            recipient_id=recipient_id,
            subject_type=subject_type,
            subject_id=subject_id,
            kind=AnnouncementKind.REMOVED,
            notification_type=final.notification_type,
            level=final.level,
            metadata=dict(final.metadata),
            row_ids=row_ids,
        )

    if final is not None:
        return ResolvedAnnouncement(
            recipient_id=recipient_id,
            subject_type=subject_type,
            subject_id=subject_id,
            kind=AnnouncementKind.CREATED,
            notification_type=final.notification_type,
            level=final.level,
            metadata=_freshened(final.metadata, group[-1].metadata),
            row_ids=row_ids,
        )

    diffs = list(group)
    changes, surviving = _collapse_changes(diffs)
    if not changes:
        return None

    latest = diffs[-1]
    level = max(
        (row.level for row in diffs if row.change_field in surviving),
        key=lambda value: _LEVEL_RANK.get(value, 0),
    )
    return ResolvedAnnouncement(
        recipient_id=recipient_id,
        subject_type=subject_type,
        subject_id=subject_id,
        kind=AnnouncementKind.CHANGED,
        notification_type=latest.notification_type,
        level=level,
        metadata={**latest.metadata, _DIFF_KEY: changes},
        row_ids=row_ids,
    )


class AnnouncementQueue:
    """Durable, per-project store of what the cast has not been told yet."""

    @staticmethod
    def enqueue(
        *,
        project: Project,
        subject_type: str,
        subject_id: str,
        kind: str,
        notification_type: str,
        level: str = NotificationLevel.INFO,
        metadata: dict[str, Any] | None = None,
        recipient_id: str | None = None,
    ) -> list[PendingAnnouncement]:
        """Hold one event back for review.

        A field diff is stored one row per field — the granularity collapsing
        needs and the granularity the review sheet will offer. `level` is the
        baseline; a row about a time the cast has to keep is escalated on its own,
        so the urgency of a published announcement follows what survived rather
        than what was originally saved.

        Writes inside the caller's transaction on purpose: a rolled-back save
        must not leave news of a change that never happened.
        """
        payload = dict(metadata or {})
        changes = payload.pop(_DIFF_KEY, None) or []

        common: dict[str, Any] = {
            "project": project,
            "recipient_id": recipient_id,
            "subject_type": subject_type,
            "subject_id": str(subject_id),
            "kind": kind,
            "notification_type": notification_type,
            "metadata": payload,
        }

        if kind != AnnouncementKind.CHANGED:
            return [PendingAnnouncement.objects.create(level=level, **common)]

        return [
            PendingAnnouncement.objects.create(
                level=(
                    NotificationLevel.URGENT
                    if change["field"] in _TIME_CRITICAL_FIELDS
                    else level
                ),
                change_field=change["field"],
                change_old=change.get("old"),
                change_new=change.get("new"),
                **common,
            )
            for change in changes
        ]

    @staticmethod
    def pending_for(project: Project) -> list[PendingAnnouncement]:
        """Every unconsumed row for this project, oldest first — collapsing reads
        them in the order the conductor made the edits."""
        return list(
            PendingAnnouncement.objects.filter(
                project=project, published_at__isnull=True
            ).order_by("created_at")
        )

    @staticmethod
    def collapse(rows: Iterable[PendingAnnouncement]) -> list[ResolvedAnnouncement]:
        """What the pending rows would actually say, one message per subject and
        recipient."""
        groups: dict[tuple[str | None, str, str], list[PendingAnnouncement]] = {}
        for row in rows:
            groups.setdefault(_group_key(row), []).append(row)

        resolved: list[ResolvedAnnouncement] = []
        for (recipient_id, subject_type, subject_id), group in groups.items():
            announcement = _collapse_group(recipient_id, subject_type, subject_id, group)
            if announcement is not None:
                resolved.append(announcement)
        return resolved

    @staticmethod
    def recipients_for(project: Project, announcement: ResolvedAnnouncement) -> list[str]:
        """Who this announcement reaches, decided now rather than when it was queued.

        Singers who have not answered yet are included: they read the invitation
        and are deciding on its strength, so a schedule that has moved since is
        exactly what they need. Only a decline takes someone out of the audience.

        That rule holds for a personal announcement too. Someone who declines
        between an edit to their part and the publication of it has ended the
        conversation; sending them the voice line they turned down would read as
        the app not having heard them. A *removal* still goes out — the person has
        no live participation left at all, so nothing here filters it.
        """
        from roster.models import Participation, Rehearsal

        if announcement.recipient_id:
            declined = Participation.objects.filter(
                project=project,
                is_deleted=False,
                artist__user_id=announcement.recipient_id,
                status=Participation.Status.DECLINED,
            ).exists()
            return [] if declined else [announcement.recipient_id]

        cast = Participation.objects.filter(project=project, is_deleted=False)
        if announcement.subject_type == AnnouncementSubject.REHEARSAL:
            rehearsal = Rehearsal.objects.filter(id=announcement.subject_id).first()
            if rehearsal is None:
                # The rehearsal went away without flushing its queue. Announcing
                # it to the cast would describe something that no longer exists.
                logger.warning(
                    "[AnnouncementQueue] Dropping announcement for missing rehearsal %s.",
                    announcement.subject_id,
                )
                return []
            sectional = rehearsal.invited_participations.filter(is_deleted=False)
            if sectional.exists():
                cast = sectional

        return NotificationRecipientPolicy.in_conversation(cast)

    @staticmethod
    def plan(
        project: Project,
        rows: Sequence[PendingAnnouncement],
        *,
        has_note: bool = False,
    ) -> PublicationPlan:
        """Work out what each recipient would actually receive.

        A recipient with one piece of news gets that event's own message: "Rehearsal
        moved — Friday at 19:00" names the thing that happened far better than a
        briefing wrapping a single line ever could. Only when someone has several
        does the fold earn its keep — and a note from the conductor always does,
        because it is addressed to the reader rather than describing a field.

        Only the note's *presence* changes the arithmetic, which is why this takes a
        flag and not the text: the review sheet can then recount as soon as the
        conductor starts writing, without refetching on every keystroke.
        """
        announcements = AnnouncementQueue.collapse(rows)
        audiences = [
            AnnouncementQueue.recipients_for(project, announcement)
            for announcement in announcements
        ]

        standalone: list[int] = []
        per_recipient: dict[str, list[int]] = {}
        for index, announcement in enumerate(announcements):
            if not audiences[index]:
                continue
            if announcement.subject_type in _STANDALONE_SUBJECTS:
                standalone.append(index)
                continue
            for recipient_id in audiences[index]:
                per_recipient.setdefault(recipient_id, []).append(index)

        solo: dict[int, list[str]] = {}
        briefings: dict[str, list[int]] = {}
        for recipient_id, indices in per_recipient.items():
            if len(indices) == 1 and not has_note:
                solo.setdefault(indices[0], []).append(recipient_id)
            else:
                briefings[recipient_id] = indices

        return PublicationPlan(
            announcements=announcements,
            audiences=audiences,
            standalone=standalone,
            solo=solo,
            briefings=briefings,
        )

    @staticmethod
    def describe(
        project: Project,
        rows: Sequence[PendingAnnouncement],
        *,
        held: set[str] | None = None,
    ) -> list[QueuedChange]:
        """Every pending change as a review-sheet line.

        Describes the whole queue, held rows included: the conductor has to see
        what they are holding back, not just what is going out. `is_held` marks
        them, and the counts around this list are computed from the rest.
        """
        held = held or set()
        announcements = AnnouncementQueue.collapse(rows)
        audiences = [
            AnnouncementQueue.recipients_for(project, announcement)
            for announcement in announcements
        ]
        names = _recipient_names({
            announcement.recipient_id
            for announcement in announcements
            if announcement.recipient_id
        })

        # Rows keyed the way lines are, so a project diff's fields can each carry
        # the rows that produced them — the granularity enqueue stored them at.
        rows_by_line: dict[str, list[PendingAnnouncement]] = {}
        for row in rows:
            key = _line_id(
                str(row.recipient_id) if row.recipient_id else None,
                row.subject_type,
                row.subject_id,
                row.change_field,
            )
            rows_by_line.setdefault(key, []).append(row)

        lines: list[QueuedChange] = []
        for index, announcement in enumerate(announcements):
            lines.extend(_lines_for(
                announcement,
                recipient_count=len(audiences[index]),
                recipient_name=names.get(announcement.recipient_id or "", ""),
                rows_by_line=rows_by_line,
                held=held,
            ))
        return lines

    @staticmethod
    def preview(
        project: Project,
        *,
        has_note: bool = False,
        exclude: Iterable[str] = (),
    ) -> dict[str, Any]:
        """What publishing the queue would send, without sending it.

        The lines describe everything pending; the counts describe what the current
        selection would actually send. Both come from the same partition and the
        same plan the publication uses, so the number on the confirm button cannot
        promise something else.
        """
        rows = AnnouncementQueue.pending_for(project)
        taken, held = _partition(rows, exclude)
        plan = AnnouncementQueue.plan(project, taken, has_note=has_note)
        lines = AnnouncementQueue.describe(project, rows, held=held)

        # Which lines each person is about to receive, so the sheet can show the
        # fold from the reader's side — one name, the changes that reach them, and
        # whether it arrives as a briefing or as its own message.
        per_recipient: dict[str, list[str]] = {}

        def attribute(recipient_id: str, index: int) -> None:
            per_recipient.setdefault(recipient_id, []).extend(
                _line_ids_of(plan.announcements[index])
            )

        for index in plan.standalone:
            for recipient_id in plan.audiences[index]:
                attribute(recipient_id, index)
        for index, recipient_ids in plan.solo.items():
            for recipient_id in recipient_ids:
                attribute(recipient_id, index)
        for recipient_id, indices in plan.briefings.items():
            for index in indices:
                attribute(recipient_id, index)

        # How long the *news* has been waiting, which is not how long the rows
        # have. A field moved and moved back leaves rows that say nothing, and
        # dating the queue from them would start the nudge's fuse on something
        # that will never be sent — the same error as counting rows instead of
        # messages, one step further in.
        #
        # Measured per line rather than per announcement, because the line is the
        # atom everywhere else in this surface: a project diff's dead field is
        # dropped with its rows, while a rehearsal's whole diff is one indivisible
        # fact and is therefore as old as its oldest row. Held lines are excluded
        # for the same reason they are excluded from the counts — they are not
        # what this publication would send.
        live_row_ids = {
            row_id
            for line in lines
            if line.recipient_count and not line.is_held
            for row_id in line.row_ids
        }
        waiting_since = min(
            (row.created_at for row in rows if str(row.id) in live_row_ids),
            default=None,
        )

        names = _recipient_names(set(per_recipient))
        return {
            "project_id": str(project.id),
            # None exactly when nothing would be sent; DRF renders it ISO-8601.
            "waiting_since": waiting_since,
            # Raw rows still waiting. Higher than `change_count` whenever a value
            # moved and moved back: the rows are still there, the change is not.
            "pending_count": len(rows),
            "change_count": len(lines),
            # How many envelopes leave. `change_count` is how many things changed;
            # this is the number worth putting on a confirm button, and the two
            # differ precisely because of the fold.
            "message_count": plan.message_count,
            "briefing_count": len(plan.briefings),
            "recipient_count": len(plan.recipient_ids),
            # Discarding the queue would leave this person removed and never told —
            # the one row whose silence is a defect rather than a choice. Held rows
            # count: discarding drops them too.
            "has_cast_removal": any(
                line.subject_type in _STANDALONE_SUBJECTS
                and line.kind == AnnouncementKind.REMOVED
                for line in lines
            ),
            "changes": [
                {
                    "id": line.id,
                    "row_ids": list(line.row_ids),
                    "subject_type": line.subject_type,
                    "subject_id": line.subject_id,
                    "kind": line.kind,
                    "notification_type": line.notification_type,
                    "level": line.level,
                    "field": line.field,
                    "metadata": line.metadata,
                    "recipient_count": line.recipient_count,
                    "recipient_name": line.recipient_name,
                    "is_held": line.is_held,
                }
                for line in lines
            ],
            "recipients": [
                {
                    "recipient_id": recipient_id,
                    "name": names.get(recipient_id, ""),
                    "change_ids": line_ids,
                    "is_briefing": recipient_id in plan.briefings,
                }
                for recipient_id, line_ids in per_recipient.items()
            ],
        }

    @staticmethod
    def publish(
        project: Project,
        *,
        note: str = "",
        exclude: Iterable[str] = (),
    ) -> dict[str, int]:
        """Send the queue and consume it.

        Every row this publication takes is stamped, including the ones collapsing
        silenced — they were resolved by it, they simply had nothing to say. Held
        rows are left untouched and pending, so the next review shows them again.
        """
        rows = AnnouncementQueue.pending_for(project)
        taken, held = _partition(rows, exclude)
        if not taken:
            return {
                "announcements": 0, "messages": 0, "briefings": 0,
                "recipients": 0, "rows": 0, "held": len(held),
            }

        with transaction.atomic():
            plan = AnnouncementQueue.plan(project, taken, has_note=bool(note))

            for index in plan.standalone:
                _dispatch(plan.announcements[index], plan.audiences[index])

            for index, recipient_ids in plan.solo.items():
                _dispatch(plan.announcements[index], recipient_ids)

            for recipient_id, indices in plan.briefings.items():
                _dispatch_briefing(
                    project,
                    recipient_id,
                    [plan.announcements[index] for index in indices],
                    note=note,
                )

            now = timezone.now()
            PendingAnnouncement.objects.filter(
                id__in=[row.id for row in taken]
            ).update(published_at=now, updated_at=now)

        logger.info(
            "[AnnouncementQueue] Published %d row(s) on project %s as %d message(s) "
            "(%d briefing(s)) to %d recipient(s); %d row(s) held back.",
            len(taken), project.id, plan.message_count,
            len(plan.briefings), len(plan.recipient_ids), len(held),
        )
        return {
            "announcements": len(plan.announcements),
            "messages": plan.message_count,
            "briefings": len(plan.briefings),
            "recipients": len(plan.recipient_ids),
            "rows": len(taken),
            "held": len(held),
        }

    @staticmethod
    def discard(project: Project, *, ids: Sequence[str] | None = None) -> int:
        """Drop pending rows without telling anyone. The saved data stands — only
        the announcement is abandoned."""
        queryset = PendingAnnouncement.objects.filter(
            project=project, published_at__isnull=True
        )
        if ids is not None:
            queryset = queryset.filter(id__in=list(ids))
        return queryset.update(is_deleted=True, updated_at=timezone.now())

    @staticmethod
    def discard_subject(project: Project, subject_type: str, subject_id: str) -> int:
        """Drop what is pending about one thing — used when that thing is
        cancelled and the alarm supersedes every edit made to it."""
        return PendingAnnouncement.objects.filter(
            project=project,
            published_at__isnull=True,
            subject_type=subject_type,
            subject_id=str(subject_id),
        ).update(is_deleted=True, updated_at=timezone.now())

    @staticmethod
    def discard_recipient(project: Project, recipient_id: str) -> int:
        """Drop one person's pending personal rows — used when they leave the
        cast, since their seat on a piece is no longer news to them."""
        return PendingAnnouncement.objects.filter(
            project=project,
            published_at__isnull=True,
            recipient__pk=recipient_id,
        ).update(is_deleted=True, updated_at=timezone.now())

    @staticmethod
    def stale(now: datetime) -> list[StaleQueue]:
        """Live projects whose queue has been waiting longer than it should.

        The safety net under the whole feature. Batching converts "too much noise"
        into "possibly no signal", and a choir that *believes* it knows the
        schedule is worse off than a spammed one — so the one failure this design
        introduces is a queue nobody ever publishes. Everything else about the
        queue is patient by intent; this is the one part that keeps time.

        Three gates, and each one exists to keep the nudge honest:

          • **The concert has not happened yet.** After it, a held rehearsal move
            is archaeology, and a project left ACTIVE would otherwise nag forever.
          • **Publication would actually send something.** A queue whose every row
            cancelled out has rows but no news; saying "3 changes are waiting"
            about it would be the one thing this feature cannot afford to be —
            wrong about its own numbers.
          • **The fuse, taken from what survived collapsing** — both its length
            and where it starts counting. Urgency is read off the lines that will
            really be sent, so a reschedule that was reverted does not keep the
            short fuse it was queued with; and the clock starts at the oldest row
            behind news that still reaches somebody, so a mutually-cancelling edit
            made yesterday cannot age a change made an hour ago.

        The cooldown is the same length as the fuse rather than a fixed day, which
        is what lets an escalation break through: a calm nudge sent this morning
        does not silence the reschedule queued at noon, because that row's fuse is
        four hours and the morning stamp is already older than that.
        """
        from roster.models import Project as ProjectModel

        candidates = (
            ProjectModel.objects
            .filter(status=ProjectModel.Status.ACTIVE, date_time__gte=now)
            .annotate(
                queued_since=Min(
                    "pending_announcements__created_at",
                    filter=Q(
                        pending_announcements__published_at__isnull=True,
                        # Mirrors `pending_for`, which reads through the default
                        # manager: a discarded row is gone, but the reverse
                        # relation would still walk straight into it.
                        pending_announcements__is_deleted=False,
                    ),
                )
            )
            .filter(queued_since__isnull=False)
            .order_by("date_time")
        )

        shortest = min(_fuse(NotificationLevel.URGENT), _fuse(NotificationLevel.INFO))
        stale: list[StaleQueue] = []
        for project in candidates:
            # A cheap lower bound on the real wait, so the collapse below is only
            # paid for by projects that could possibly be due: the oldest row is
            # never newer than the oldest surviving one.
            if now - project.queued_since < shortest:
                continue

            preview = AnnouncementQueue.preview(project)
            # `waiting_since` is None exactly when no line would be sent, which
            # `message_count` also reports — the pair is checked together rather
            # than trusting them to agree.
            waiting_since = preview["waiting_since"]
            if not preview["message_count"] or waiting_since is None:
                continue

            # Only lines that reach somebody set the urgency. An alarm addressed to
            # a cast that has since declined it is not a reason to hurry.
            level = max(
                (
                    str(line["level"])
                    for line in preview["changes"]
                    if line["recipient_count"]
                ),
                key=lambda value: _LEVEL_RANK.get(value, 0),
                default=NotificationLevel.INFO,
            )

            fuse = _fuse(level)
            if now - waiting_since < fuse:
                continue
            if project.announcement_nudged_at and now - project.announcement_nudged_at < fuse:
                continue

            stale.append(StaleQueue(
                project=project,
                waiting_since=waiting_since,
                level=level,
                fuse=fuse,
                change_count=preview["change_count"],
                recipient_count=preview["recipient_count"],
            ))
        return stale

    @staticmethod
    def has_unannounced_creation(project: Project, subject_type: str, subject_id: str) -> bool:
        """Whether this subject was created and never announced.

        Cancelling such a thing is silent for the same reason a draft cancelled
        before publication is: nobody was told it existed.
        """
        return PendingAnnouncement.objects.filter(
            project=project,
            published_at__isnull=True,
            subject_type=subject_type,
            subject_id=str(subject_id),
            kind=AnnouncementKind.CREATED,
        ).exists()


def _is_divisible(announcement: ResolvedAnnouncement) -> bool:
    """Whether this announcement becomes one review line per field.

    Only a project diff does. Its fields are heterogeneous and separately
    meaningful — a venue and a dress code have nothing to do with each other — so
    the sheet offers them one by one, which is the granularity `enqueue` stored
    them at and the case Stage 1 split rows for. A rehearsal's diff is the opposite:
    "it moved, and the focus changed with it" is one fact about one evening, and the
    composer already renders it as one line on the artist's side.
    """
    return (
        announcement.kind == AnnouncementKind.CHANGED
        and announcement.subject_type == AnnouncementSubject.PROJECT
    )


def _line_ids_of(announcement: ResolvedAnnouncement) -> list[str]:
    """The review-sheet lines this announcement appears as, by id alone."""
    base = (announcement.recipient_id, announcement.subject_type, announcement.subject_id)
    if not _is_divisible(announcement):
        return [_line_id(*base, "")]
    return [
        _line_id(*base, str(change.get("field", "")))
        for change in announcement.metadata.get(_DIFF_KEY) or []
    ]


def _lines_for(
    announcement: ResolvedAnnouncement,
    *,
    recipient_count: int,
    recipient_name: str,
    rows_by_line: dict[str, list[PendingAnnouncement]],
    held: set[str],
) -> list[QueuedChange]:
    """One collapsed announcement as the lines the review sheet offers."""
    base = (announcement.recipient_id, announcement.subject_type, announcement.subject_id)
    common: dict[str, Any] = {
        "subject_type": announcement.subject_type,
        "subject_id": announcement.subject_id,
        "kind": announcement.kind,
        "notification_type": announcement.notification_type,
        "recipient_count": recipient_count,
        "recipient_name": recipient_name,
    }

    def payload(metadata: dict[str, Any]) -> dict[str, Any]:
        """The line's own facts. The calendar event is dropped: it is per message,
        it is bulky, and the sheet has no use for it."""
        return {key: value for key, value in metadata.items() if key != _CALENDAR_KEY}

    if not _is_divisible(announcement):
        return [QueuedChange(
            id=_line_id(*base, ""),
            row_ids=announcement.row_ids,
            level=announcement.level,
            field="",
            metadata=payload(announcement.metadata),
            is_held=all(row_id in held for row_id in announcement.row_ids),
            **common,
        )]

    lines: list[QueuedChange] = []
    for change in announcement.metadata.get(_DIFF_KEY) or []:
        field_key = str(change.get("field", ""))
        line_id = _line_id(*base, field_key)
        rows = rows_by_line.get(line_id, [])
        row_ids = tuple(str(row.id) for row in rows) or announcement.row_ids
        lines.append(QueuedChange(
            id=line_id,
            row_ids=row_ids,
            # Per field, not the announcement's loudest: the sheet has to show
            # which line is the alarm, so holding the reschedule visibly calms the
            # rest of the diff.
            level=max(
                (row.level for row in rows),
                key=lambda value: _LEVEL_RANK.get(value, 0),
                default=announcement.level,
            ),
            field=field_key,
            metadata={**payload(announcement.metadata), _DIFF_KEY: [change]},
            is_held=bool(row_ids) and all(row_id in held for row_id in row_ids),
            **common,
        ))
    return lines


def _recipient_names(user_ids: set[str]) -> dict[str, str]:
    """Display names for the people personal lines are addressed to.

    Resolved from the artist projection of the account, and through `all_objects`
    on purpose: the point of this lookup is often someone who has just been taken
    off the cast, and their name is exactly what the sheet must show.
    """
    if not user_ids:
        return {}

    from roster.models import Artist

    names = {
        str(user_id): f"{first} {last}".strip()
        for user_id, first, last in Artist.all_objects.filter(
            user_id__in=user_ids
        ).values_list("user_id", "first_name", "last_name")
    }

    missing = user_ids - set(names)
    if missing:
        from django.contrib.auth import get_user_model

        names.update({
            str(pk): f"{first} {last}".strip() or username
            for pk, first, last, username in get_user_model().objects.filter(
                pk__in=missing
            ).values_list("pk", "first_name", "last_name", "username")
        })
    return {key: value for key, value in names.items() if value}


def _dispatch_briefing(
    project: Project,
    recipient_id: str,
    announcements: Sequence[ResolvedAnnouncement],
    *,
    note: str,
) -> None:
    """Hand one recipient's whole share of the queue over as a single message.

    Each item keeps the payload its own emitter built, so a briefing line renders
    from exactly the same facts the standalone message would have used and no
    surface needs a second vocabulary for a rehearsal or a part. Grouping and
    ordering are left to the composer, which owns how a briefing reads.

    The level is the loudest item's: a briefing that contains a reschedule is an
    alarm, however calm the rest of it is.
    """
    from .dtos import BriefingItemMetadata, ProjectBriefingMetadata

    items: list[BriefingItemMetadata] = []
    calendar: list[dict[str, Any]] = []
    for announcement in announcements:
        payload = dict(announcement.metadata)
        event = payload.pop(_CALENDAR_KEY, None)
        if isinstance(event, dict):
            calendar.append(event)
        items.append(BriefingItemMetadata(
            subject_type=announcement.subject_type,
            kind=announcement.kind,
            notification_type=announcement.notification_type,
            level=announcement.level,
            metadata=payload,
        ))

    level = max(
        (announcement.level for announcement in announcements),
        key=lambda value: _LEVEL_RANK.get(value, 0),
    )
    metadata = ProjectBriefingMetadata(
        project_id=project.id,
        project_name=project.title,
        event_kind=project.event_kind,
        note=note,
        items=tuple(items),
        ics=tuple(calendar),
    ).model_dump(mode="json")

    transaction.on_commit(partial(
        send_notification_task.delay,
        recipient_id=recipient_id,
        notification_type=NotificationType.PROJECT_BRIEFING,
        level=level,
        metadata=metadata,
    ))


def _dispatch(announcement: ResolvedAnnouncement, recipient_ids: list[str]) -> None:
    """Hand one collapsed announcement to the delivery tasks, once the publication
    commits. Personal and broadcast keep their own tasks so the dispatch shape
    matches the announcement's nature, not the size its audience happened to be."""
    if announcement.recipient_id:
        transaction.on_commit(partial(
            send_notification_task.delay,
            recipient_id=recipient_ids[0],
            notification_type=announcement.notification_type,
            level=announcement.level,
            metadata=announcement.metadata,
        ))
        return

    transaction.on_commit(partial(
        send_bulk_notifications_task.delay,
        recipient_ids=recipient_ids,
        notification_type=announcement.notification_type,
        level=announcement.level,
        metadata=announcement.metadata,
    ))
