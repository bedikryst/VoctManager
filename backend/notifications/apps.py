from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'

    def ready(self) -> None:
        # Register ESP delivery-event handlers (bounce/complaint suppression).
        from . import signals  # noqa: F401

        # A new NotificationType left out of the preference groups degrades
        # silently — it renders the raw English Django label in the settings
        # ledger and answers to no control. Fail at boot instead.
        from .delivery import assert_preference_policy_is_coherent
        assert_preference_policy_is_coherent()

        # A selected ESP with an empty credential does not fail here — it fails at the
        # provider, as a 401 naming the key rather than the variable behind it.
        from .email_service import assert_esp_is_configured
        assert_esp_is_configured()