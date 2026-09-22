"""
Infrastructure-level periodic tasks.

These belong to no business domain — they exist to prove the asynchronous
pipeline itself is alive.
"""

import logging
from datetime import timedelta

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Note

logger = logging.getLogger(__name__)

# How long a completed note is kept before the row is destroyed, counted from
# `done_at`. Long enough to be a short-term undo, short enough that the done
# section stays a recent-history strip rather than an archive nobody scrolls.
NOTE_RETENTION = timedelta(days=30)


@shared_task(name='core.ping_beat_heartbeat')
def ping_beat_heartbeat() -> bool:
    """
    Pings an external heartbeat monitor to prove the periodic pipeline is alive.

    This is an end-to-end proof rather than a cron echo: the ping only happens
    if beat scheduled the task AND the broker delivered it AND a worker consumed
    it, so a dead scheduler, an unreachable Redis and a hung worker all surface
    the same way — as a ping that never arrives. Alerting on an ABSENT signal is
    the only scheme that still fires when the whole stack is down, which is
    exactly how the backup job managed to stop silently for a month.

    Returns True when a ping was sent, False when none was configured or the
    monitor could not be reached.
    """
    url: str = settings.BEAT_HEARTBEAT_URL
    if not url:
        return False

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        # Never retried and never raised: a flaky monitor must not become a
        # source of alerts about itself, nor burn worker slots. A genuinely dead
        # pipeline is reported by the missing ping, not by this task failing.
        logger.warning('Beat heartbeat ping failed', exc_info=True)
        return False

    return True


@shared_task(name='core.purge_completed_notes')
def purge_completed_notes() -> int:
    """
    Hard-deletes notes past `NOTE_RETENTION` since `done_at`, so the personal
    scratchpad's done section stays a short-term undo rather than growing
    without bound. THE DELETE IS HARD — a private note has no basis to be
    held once its retention window has run, and `SoftDeleteQuerySet.delete()`
    would only flag the row, not remove it.

    Scheduled daily via CELERY_BEAT_SCHEDULE; requires the `celery beat`
    process. Idempotent and safe to re-run.
    """
    cutoff = timezone.now() - NOTE_RETENTION
    ids = list(
        Note.all_objects.filter(is_done=True, done_at__lte=cutoff).values_list('pk', flat=True)
    )
    if ids:
        Note.all_objects.filter(pk__in=ids).hard_delete()
    return len(ids)
