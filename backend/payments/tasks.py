# payments/tasks.py
# ==========================================
# Payments & Donations — Asynchronous Reconciliation
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import Donation, DonationStatus

logger = logging.getLogger(__name__)

# A donation that never reached the gateway return flow within this window is
# treated as abandoned. Axepta's own payment-link TTL is shorter than this, so
# a PENDING row older than the window can no longer realistically be settled.
STALE_PENDING_HOURS = 24


@shared_task(name='payments.expire_stale_pending_donations')
def expire_stale_pending_donations() -> int:
    """
    Marks abandoned PENDING donations as FAILED so the table does not accumulate
    unbounded orphans (gateway errors, users closing the tab, abuse traffic).
    Returns the number of rows transitioned. Idempotent and safe to re-run.

    Scheduled hourly via CELERY_BEAT_SCHEDULE; requires the `celery beat`
    process to be running.
    """
    cutoff = timezone.now() - timedelta(hours=STALE_PENDING_HOURS)
    stale = Donation.objects.filter(
        status=DonationStatus.PENDING, created_at__lt=cutoff
    )
    count = stale.update(status=DonationStatus.FAILED, updated_at=timezone.now())
    if count:
        logger.info(
            "Expired %d stale PENDING donation(s) older than %dh.",
            count, STALE_PENDING_HOURS,
        )
    return count
