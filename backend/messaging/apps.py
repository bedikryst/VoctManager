"""
@file apps.py
@description App configuration for the messaging domain (async conductor ↔ chorister threads).
@architecture Enterprise SaaS 2026
@module messaging/apps
"""
from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'messaging'
    verbose_name = 'Messaging'

    def ready(self) -> None:
        # Register GDPR erasure signal receivers.
        from . import signals  # noqa: F401
