"""
Liveness and readiness probes.

Two endpoints with deliberately different contracts:

``/api/health/`` — **liveness**. Requested by the Docker healthcheck (see
docker-compose.yml, ``web`` service) from inside the container. Trivial on
purpose: no auth, no database, no serialization — it only proves that gunicorn
(or the dev runserver) is up and Django is routing requests. Keep it
dependency-free so a degraded database never flaps the container itself;
restarting a process because Postgres is slow just produces a process that comes
back equally degraded, and it would cascade into celery via ``depends_on``.

``/api/health/ready/`` — **readiness**. Polled by the external uptime monitor.
This one does touch the dependencies, so it answers the different question
"could this instance actually serve a request right now", and returns 503 when
it could not. Deliberately NOT wired to the Docker healthcheck, for the reason
above.

The readiness payload names which dependency failed but never echoes the driver
error. The endpoint is unauthenticated, and exception text leaks hostnames,
credential fragments and library versions to anyone who curls it; the detail
belongs in the log, which is where it goes.
"""

import logging
from typing import Any

from django.core.cache import cache
from django.db import connections
from django.http import HttpRequest, JsonResponse

logger = logging.getLogger(__name__)

# Namespaced so a readiness poll can never collide with a real cached value.
_READINESS_PROBE_KEY = 'healthcheck:readiness-probe'


def health(request: HttpRequest) -> JsonResponse:
    return JsonResponse({'status': 'ok'})


def ready(request: HttpRequest) -> JsonResponse:
    checks: dict[str, str] = {}

    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:
        logger.exception('Readiness probe: database check failed')
        checks['database'] = 'error'
    else:
        checks['database'] = 'ok'

    # Redis backs both the cache and the Celery broker, so one round-trip covers
    # both. A write-then-read rather than a bare PING is deliberate: it also
    # catches a Redis that is reachable but refusing writes (maxmemory reached
    # under a noeviction policy), which a PING reports as perfectly healthy.
    try:
        cache.set(_READINESS_PROBE_KEY, 'ok', 30)
        if cache.get(_READINESS_PROBE_KEY) != 'ok':
            raise RuntimeError('cache round-trip did not return the written value')
    except Exception:
        logger.exception('Readiness probe: redis check failed')
        checks['redis'] = 'error'
    else:
        checks['redis'] = 'ok'

    healthy = all(state == 'ok' for state in checks.values())
    payload: dict[str, Any] = {
        'status': 'ok' if healthy else 'degraded',
        'checks': checks,
    }
    return JsonResponse(payload, status=200 if healthy else 503)
