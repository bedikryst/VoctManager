# outreach/tasks.py
# ==========================================
# Outreach — retention sweeps for the concert notice list
# Standard: Enterprise SaaS 2026
# ==========================================
import logging

from celery import shared_task
from django.db.models import Max
from django.utils import timezone

from .models import (
    CONFIRM_TOKEN_TTL,
    EVIDENCE_RETENTION,
    ConcertNoticeSubscription,
    NoticeStatus,
)

logger = logging.getLogger(__name__)


@shared_task(name='outreach.purge_notice_records')
def purge_notice_records() -> dict[str, int]:
    """
    Makes the retention the privacy policy publishes (§ 7) true, in two sweeps.

    THE DELETES ARE HARD, and that is the whole point. `SoftDeleteQuerySet.delete()` would
    set `is_deleted` and leave the address in the table — which is exactly the outcome
    neither sweep may produce, since both exist because we no longer have a reason to hold
    the address at all. `hard_delete()` is the escape hatch that model provides for this.

    1. A sign-up nobody ever confirmed, whose link has expired, is an address held with NO
       consent. It goes — unless the row also carries consent events, which means this
       address DID consent at some point and abandoned a later re-subscription; that row's
       evidence is governed by sweep 2 instead.
    2. A row that is NOT a live consent and whose whole history is older than the published
       period. The accountability duty outlives the consent; it does not outlive the
       limitation period for a claim about the mail it licensed.

    THE TWO SWEEPS MEET WITHOUT OVERLAPPING, and sweep 2 is written around both halves of
    that. It takes every row that is not CONFIRMED — the withdrawn one AND the abandoned
    re-subscription sweep 1 hands over; reading it as "the withdrawn ones" leaves that
    second row deleted by neither sweep, which is an address held forever with no consent
    behind it. It stops short of the one row where the two would collide: a PENDING sign-up
    whose link is still clickable, which sweep 1 is also still waiting out.

    Scheduled daily via CELERY_BEAT_SCHEDULE; requires the `celery beat` process.
    Idempotent and safe to re-run.
    """
    now = timezone.now()

    def purge(queryset) -> int:
        """
        Resolve to ids first, then delete by primary key. Both sweeps filter across the
        events relation, and a delete over a join is the one place a `hard_delete()` could
        behave differently than it reads; by pk it cannot. It also makes the count the
        number of SUBSCRIPTIONS removed rather than the cascade's total, which would have
        silently included every event row.
        """
        ids = list(queryset.values_list('pk', flat=True))
        if ids:
            ConcertNoticeSubscription.all_objects.filter(pk__in=ids).hard_delete()
        return len(ids)

    unconfirmed_purged = purge(
        ConcertNoticeSubscription.all_objects.filter(
            status=NoticeStatus.PENDING,
            confirm_sent_at__lt=now - CONFIRM_TOKEN_TTL,
            consent_events__isnull=True,
        )
    )

    # `at` is the event's own moment, so "the newest event is older than the window" is the
    # test — a row whose consent was withdrawn last week keeps a grant from four years ago.
    # The aggregate carries that sentence exactly, and it also settles the row sweep 1 skips
    # for having a history: an address with no events at all yields NULL here and NULL is
    # never `< cutoff`, so a sign-up still inside its seven days cannot fall through to here.
    evidence_purged = purge(
        ConcertNoticeSubscription.all_objects.exclude(
            # A live consent is kept for as long as it is live; only its withdrawal starts
            # this clock. Everything else — withdrawn, or pending on top of an old consent —
            # is held solely as evidence, and evidence is what expires.
            status=NoticeStatus.CONFIRMED,
        ).exclude(
            # A SIGN-UP WHOSE LINK IS STILL CLICKABLE IS NOT MERELY EVIDENCE, and the row
            # that reaches here carries both: expired proof of an old consent AND a fresh
            # ask. Taking it would delete a confirmation link out of somebody's inbox
            # minutes after they requested it, and they would keep re-requesting it — the
            # sweep runs nightly, the link lives seven days. The two things share a row and
            # only one of them can win, so the expired half waits out the token; the row is
            # taken on a later run, or it is confirmed and its newest event is today.
            #
            # This is sweep 1's own condition mirrored, which is what keeps the two from
            # overlapping: there, an expired token is what makes a PENDING row takeable.
            # A row with no `confirm_sent_at` has no live link and is not excluded — NULL
            # is never `>=` anything.
            status=NoticeStatus.PENDING,
            confirm_sent_at__gte=now - CONFIRM_TOKEN_TTL,
        ).annotate(
            newest_event=Max('consent_events__at'),
        ).filter(
            newest_event__lt=now - EVIDENCE_RETENTION,
        )
    )

    if unconfirmed_purged or evidence_purged:
        logger.info(
            "Notice list purge: %d unconfirmed sign-up(s), %d expired consent record(s).",
            unconfirmed_purged, evidence_purged,
        )
    return {'unconfirmed': unconfirmed_purged, 'evidence': evidence_purged}
