"""
@file tasks.py
@description The copy desk's one scheduled job: telling the reviewers that an
             editor has been through the desk. Raised by the clock rather than
             by a write, because the thing worth reporting is that somebody has
             STOPPED editing, and only a sweep can observe a pause.
@architecture Enterprise SaaS 2026
@module copydesk/tasks
"""
from __future__ import annotations

import logging
from datetime import timedelta

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
#: rounds and the desk autosaves, so there is no submit button to hang a digest
#: on. Thirty minutes is long enough that a pause to look something up does not
#: split a sitting in two, and short enough that an evening's work is reported
#: the same evening. Against the hourly beat below, a continuous two-hour sitting
#: produces one message, not four.
QUIET_PERIOD = timedelta(minutes=30)


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
        author_id = row["author_id"]
        pending = list(
            CopyProposal.objects.filter(
                author_id=author_id,
                status=ProposalStatus.PROPOSED,
                notified_at__isnull=True,
            ).select_related("segment", "author")
        )
        if not pending:
            continue

        # Claim before dispatching, and restate the condition in the write: two
        # beats or two workers reading this queue at once would otherwise both
        # pass the check above and both send. Same guard as the announcement
        # nudge, and needed for the same reason.
        # `updated_at` is deliberately left alone: announcing a proposal is
        # bookkeeping, not an edit, and the desk shows that column as when the
        # editor last worked on the segment.
        claimed = CopyProposal.objects.filter(
            id__in=[proposal.id for proposal in pending],
            notified_at__isnull=True,
        ).update(notified_at=now)
        if not claimed:
            continue

        # An editor who also reviews is not told about their own sitting.
        recipients = [
            uid for uid in reviewer_ids if uid != str(author_id)
        ]
        if not recipients:
            logger.info(
                "[CopyDesk] %d proposal(s) by UID:%s have no reviewer to tell.",
                len(pending), author_id,
            )
            continue

        send_bulk_notifications_task.delay(
            recipient_ids=recipients,
            notification_type=NotificationType.SITE_COPY_PROPOSED,
            level=NotificationLevel.INFO,
            metadata=_digest_metadata(pending).model_dump(mode="json"),
        )
        sent += 1

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
