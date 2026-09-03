"""
@file tasks.py
@description Telling the reviewers that an editor has been through the desk.
             The sweep below is the GUARANTEE — it observes that somebody has
             stopped editing, which only a clock can see — and the desk's
             "I have finished" control is the same digest raised early by hand
             (`CopyDeskNotifyView`). Both go through `dispatch_digest_for_author`,
             so an editor who never finds the control loses nothing but time.
@architecture Enterprise SaaS 2026
@module copydesk/tasks
"""
from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from celery import shared_task
from django.db.models import Max
from django.utils import timezone

from notifications.dtos import CopyScopeMetadata, SiteCopyProposedMetadata
from notifications.models import NotificationLevel, NotificationType
from notifications.tasks import send_bulk_notifications_task

from .models import CopyProposal, ProposalStatus
from .permissions import copy_desk_reviewers

logger = logging.getLogger(__name__)

#: How long an editor must have been still before their sitting is reported.
#:
#: This is the definition of "a session", and it has to be one: §1 rules out
#: rounds and the desk autosaves, so there is no submit button the WORK depends
#: on. Thirty minutes is long enough that a pause to look something up does not
#: split a sitting in two, and short enough that an evening's work is reported
#: the same evening. Against the hourly beat below, a continuous two-hour sitting
#: produces one message, not four.
QUIET_PERIOD = timedelta(minutes=30)


@dataclass(frozen=True)
class DigestOutcome:
    """What one editor's digest managed to do.

    Two numbers rather than one, because they can disagree: proposals are
    CLAIMED (stamped `notified_at`) before anything is dispatched, so an install
    with no active staff account claims a sitting it then has nobody to tell.
    Reporting that as "sent" would be a lie to the editor who pressed the button.
    """

    proposals: int = 0
    delivered: bool = False


def dispatch_digest_for_author(
    *, author_id: int, reviewer_ids: Sequence[str], now: datetime
) -> DigestOutcome:
    """Announce one editor's unannounced proposals, whatever raised the call.

    The claim comes first and restates its own condition in the write: two beats,
    two workers, or a beat racing the editor's own "I have finished" would
    otherwise all pass the read and all send. `updated_at` is deliberately left
    alone — announcing a proposal is bookkeeping, not an edit, and the desk shows
    that column as when the editor last worked on the segment.
    """
    pending = list(
        CopyProposal.objects.filter(
            author_id=author_id,
            status=ProposalStatus.PROPOSED,
            notified_at__isnull=True,
        ).select_related("segment", "author")
    )
    if not pending:
        return DigestOutcome()

    claimed = CopyProposal.objects.filter(
        id__in=[proposal.id for proposal in pending],
        notified_at__isnull=True,
    ).update(notified_at=now)
    if not claimed:
        return DigestOutcome()

    # An editor who also reviews is not told about their own sitting.
    recipients = [uid for uid in reviewer_ids if uid != str(author_id)]
    if not recipients:
        logger.info(
            "[CopyDesk] %d proposal(s) by UID:%s have no reviewer to tell.",
            len(pending), author_id,
        )
        return DigestOutcome(proposals=len(pending), delivered=False)

    send_bulk_notifications_task.delay(
        recipient_ids=recipients,
        notification_type=NotificationType.SITE_COPY_PROPOSED,
        level=NotificationLevel.INFO,
        metadata=_digest_metadata(pending).model_dump(mode="json"),
    )
    return DigestOutcome(proposals=len(pending), delivered=True)


@shared_task(name="copydesk.dispatch_copy_proposal_digests")
def dispatch_copy_proposal_digests() -> dict:
    """One digest per editor whose sitting has ended, to the accounts that review.

    Per editor rather than per page: the reader's unit of action is one trip to
    reviewer mode, and a sitting that crossed three concert pages is honestly
    described by its counts, not split into three notifications that all lead to
    the same screen.

    Per editor rather than per segment for the reason §8 suspected and the corpus
    confirms — ~500 segments, of which one concert page is dozens. A message per
    segment would be an alert per thing nobody acts on individually.

    This is the path that must never be removed. The desk offers an editor a way
    to raise their own digest early, but nothing in the record depends on their
    having pressed it: a sitting that ends by closing the laptop is reported by
    this beat, and the only difference the control makes is when.
    """
    now = timezone.now()
    cutoff = now - QUIET_PERIOD

    # Who has unannounced work, and when they last touched anything. The `Max`
    # is over ALL of an author's open proposals, so an editor still typing keeps
    # their whole sitting out of the sweep rather than having its older half
    # reported out from under them.
    settled = (
        CopyProposal.objects.filter(
            status=ProposalStatus.PROPOSED,
            notified_at__isnull=True,
            author__isnull=False,
        )
        .values("author_id")
        .annotate(last_touch=Max("updated_at"))
        .filter(last_touch__lte=cutoff)
    )

    reviewer_ids = [str(user.id) for user in copy_desk_reviewers()]
    sent = 0

    for row in settled:
        outcome = dispatch_digest_for_author(
            author_id=row["author_id"], reviewer_ids=reviewer_ids, now=now
        )
        sent += int(outcome.delivered)

    if sent:
        logger.info("[CopyDesk] Dispatched %d copy-proposal digest(s).", sent)
    return {"digests": sent}


def _digest_metadata(pending: list[CopyProposal]) -> SiteCopyProposedMetadata:
    """What the digest says, as language-neutral facts.

    Page labels travel because they are names, not copy to translate — the same
    exception `project_name` already takes. Locales travel as bare codes and are
    rendered into language names by the composer, in the reader's language.
    """
    author = pending[0].author
    counts: dict[str, int] = {}
    labels: dict[str, str] = {}
    locales: list[str] = []

    for proposal in pending:
        segment = proposal.segment
        counts[segment.scope] = counts.get(segment.scope, 0) + 1
        if segment.scope_label and not labels.get(segment.scope):
            labels[segment.scope] = segment.scope_label
        if segment.locale not in locales:
            locales.append(segment.locale)

    author_name = ""
    if author is not None:
        author_name = str(author.get_full_name() or author.email or "")

    return SiteCopyProposedMetadata(
        author_id=getattr(author, "id", None),
        author_name=author_name,
        proposal_count=len(pending),
        scopes=tuple(
            CopyScopeMetadata(scope=scope, label=labels.get(scope, ""), count=count)
            for scope, count in sorted(counts.items(), key=lambda item: -item[1])
        ),
        locales=tuple(locales),
    )
