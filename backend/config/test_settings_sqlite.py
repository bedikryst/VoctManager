"""
Host-friendly test settings: identical to ``test_settings`` but swaps the Postgres
backend for in-memory SQLite, so the suite runs with zero infrastructure (no Docker,
no Postgres on the host). Intended for fast local / agent test runs.

CI and full-fidelity runs keep ``config.test_settings`` (real Postgres) — this module
only changes the database backend, nothing else.
"""
from .test_settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
