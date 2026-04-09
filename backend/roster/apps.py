from django.apps import AppConfig


class RosterConfig(AppConfig):
    name = 'roster'
    def ready(self):
        # Connect domain event listeners
        import roster.signals  # noqa