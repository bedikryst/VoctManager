"""
Liveness endpoint for container orchestration.

The Docker healthcheck (see docker-compose.yml, `web` service) requests
``/api/health/`` from inside the container. The view is deliberately trivial:
no auth, no database, no serialization — it only proves that gunicorn (or the
dev runserver) is up and Django is routing requests. Keep it dependency-free
so a degraded database never flaps the container itself.
"""

from django.http import HttpRequest, JsonResponse


def health(request: HttpRequest) -> JsonResponse:
    return JsonResponse({'status': 'ok'})
