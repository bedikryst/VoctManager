# payments/tasks.py
# ==========================================
# Payments & Donations — Asynchronous Reconciliation
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import Donation, DonationStatus, PatronLead, PatronLeadStatus

logger = logging.getLogger(__name__)

# A donation that never reached the gateway return flow within this window is
# treated as abandoned. Axepta's own payment-link TTL is shorter than this, so
# a PENDING row older than the window can no longer realistically be settled.
STALE_PENDING_HOURS = 24

# How long a donation that never settled is kept before the row is destroyed,
# counted from the attempt itself.
#
# IT IS NOT THE FIVE YEARS THE POLICY PUBLISHES FOR DONORS, and the difference is the
# whole point: art. 74 of the Accounting Act and the Tax Ordinance govern *dowody
# księgowe* — records of an operation that reached the books. No money moved here, so
# there is no accounting document, no tax event, and under art. 890 § 1 KC no gift at
# all. The basis the row was collected under (art. 6(1)(b) — performance of a contract)
# expired when the transaction did not complete, and (c) never attached. What remains is
# a legitimate interest (f): a late webhook can still settle a FAILED row, and a donor
# whose card was charged while our webhook never arrived needs the row as the only
# correlation key we hold. Twelve months is the same window § 7 already publishes for
# HTTP logs, for the same reconciliation-and-abuse reason.
DONATION_FAILURE_RETENTION = timedelta(days=365)

# How long a patronage lead is kept after the contact it records has ended. ARCHIVED is
# an ending somebody stated; dormancy is one nobody got round to stating, and both leave
# a first name, a surname and an address held for a conversation that is over.
#
# ACTIVE IS ABSENT FROM BOTH SWEEPS, deliberately. A standing patron is a live
# relationship whose records move into the donors' accounting regime — this task must
# never be the thing that deletes them.
ARCHIVED_LEAD_RETENTION = timedelta(days=365)
DORMANT_LEAD_RETENTION = timedelta(days=2 * 365)


@shared_task(name='payments.expire_stale_pending_donations')
def expire_stale_pending_donations() -> int:
    """
    Marks abandoned PENDING donations as FAILED so the table does not accumulate
    unbounded orphans (gateway errors, users closing the tab, abuse traffic).
    Returns the number of rows transitioned. Idempotent and safe to re-run.

    IT SWEEPS `all_objects`, soft-deleted rows included. A soft delete hides a donation
    from the panel; it does not make an abandoned attempt settle. Left on the default
    manager, such a row would stay PENDING for ever — and PENDING is the one status
    `purge_failed_donations` will not collect, so it would also never expire.

    Scheduled hourly via CELERY_BEAT_SCHEDULE; requires the `celery beat`
    process to be running.
    """
    cutoff = timezone.now() - timedelta(hours=STALE_PENDING_HOURS)
    stale = Donation.all_objects.filter(
        status=DonationStatus.PENDING, created_at__lt=cutoff
    )
    count = stale.update(status=DonationStatus.FAILED, updated_at=timezone.now())
    if count:
        logger.info(
            "Expired %d stale PENDING donation(s) older than %dh.",
            count, STALE_PENDING_HOURS,
        )
    return count


@shared_task(name='payments.purge_failed_donations')
def purge_failed_donations() -> int:
    """
    Destroys the rows of donations that never happened, once the reconciliation window
    in `DONATION_FAILURE_RETENTION` has run out.

    THE DELETE IS HARD. `SoftDeleteQuerySet.delete()` would set `is_deleted` and leave the
    donor's address in the table, which is the one outcome this task may not produce: the
    row is being removed because there is no longer any basis to hold the address at all,
    and a flag is not an erasure. `hard_delete()` is the escape hatch the base model
    provides for exactly this.

    SETTLED IS UNTOUCHED AND UNREACHABLE HERE — it is accounting documentation, kept for
    the five years § 7 publishes. PENDING is unreachable too: `expire_stale_pending_donations`
    moves an abandoned attempt to FAILED within a day, so a PENDING row this old cannot
    exist, and a sweep that took one anyway would be deleting a payment still in flight.

    Scheduled daily via CELERY_BEAT_SCHEDULE; requires the `celery beat` process.
    Idempotent and safe to re-run.
    """
    cutoff = timezone.now() - DONATION_FAILURE_RETENTION
    # By pk, so the count is the number of donations removed and the delete cannot be
    # read as anything but a hard one.
    ids = list(
        Donation.all_objects.filter(
            status=DonationStatus.FAILED,
            # The attempt's own moment, not `updated_at`: the latter moves on every save
            # and would restart the clock on a row somebody merely looked at.
            created_at__lt=cutoff,
        ).values_list('pk', flat=True)
    )
    if ids:
        Donation.all_objects.filter(pk__in=ids).hard_delete()
        logger.info("Purged %d failed donation record(s) past retention.", len(ids))
    return len(ids)


@shared_task(name='payments.purge_expired_patron_leads')
def purge_expired_patron_leads() -> dict[str, int]:
    """
    Makes § 7's promise about patronage enquiries true — "usuwamy je niezwłocznie po
    zakończeniu kontaktu" — in the two shapes an ended contact actually takes.

    1. ARCHIVED: somebody said the conversation was over. The clock runs from that moment.
    2. NEW or CONTACTED with nothing touching the row for twice as long: a conversation
       that ended without anybody marking it. Without this sweep the promise holds only
       for leads a human remembered to archive, which is the majority of nothing.

    BOTH CLOCKS READ `updated_at`, and that is the field that carries the sentence: any
    hand on the lead — a status change, a note — is contact, and it restarts the period.
    `created_at` would delete a live conversation that simply started long ago.

    ACTIVE is in neither sweep. See `ARCHIVED_LEAD_RETENTION`.

    Scheduled daily via CELERY_BEAT_SCHEDULE; requires the `celery beat` process.
    Idempotent and safe to re-run.
    """
    now = timezone.now()

    def purge(**filters: object) -> int:
        ids = list(PatronLead.all_objects.filter(**filters).values_list('pk', flat=True))
        if ids:
            PatronLead.all_objects.filter(pk__in=ids).hard_delete()
        return len(ids)

    archived_purged = purge(
        status=PatronLeadStatus.ARCHIVED,
        updated_at__lt=now - ARCHIVED_LEAD_RETENTION,
    )
    dormant_purged = purge(
        status__in=[PatronLeadStatus.NEW, PatronLeadStatus.CONTACTED],
        updated_at__lt=now - DORMANT_LEAD_RETENTION,
    )

    if archived_purged or dormant_purged:
        logger.info(
            "Patron lead purge: %d archived, %d dormant.", archived_purged, dormant_purged,
        )
    return {'archived': archived_purged, 'dormant': dormant_purged}
