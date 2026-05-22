"""
Test settings: fast, hermetic, and free of production-only middleware.

Inherits the inert secrets + installed-app graph from ``typecheck_settings``, then
strips away anything that fights an in-process test run: HTTPS redirection, slow
password hashing, Redis/manifest storage, and out-of-band Celery delivery.
"""
from .typecheck_settings import *  # noqa: F403

# The test client speaks plain HTTP — never bounce it to HTTPS.
SECURE_SSL_REDIRECT = False

# Deterministic, fast hashing; tests don't need a production work factor.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Keep side effects in-process: no SMTP, no Redis, no manifest collectstatic.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Any Celery task that a test does not explicitly mock runs inline and raises.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
