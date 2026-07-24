"""
Infrastructure-level periodic tasks.

These belong to no business domain — they exist to prove the asynchronous
pipeline itself is alive.
"""

import logging

import requests
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


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
