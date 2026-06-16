import os

import firebase_admin
from django.apps import AppConfig
from django.conf import settings
from firebase_admin import credentials


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'

    def ready(self) -> None:
        # Register ESP delivery-event handlers (bounce/complaint suppression).
        from . import signals  # noqa: F401

        if settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)