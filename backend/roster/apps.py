# roster/apps.py
# ==========================================
# Roster Application Configuration
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Application configuration for the Roster domain.
Initializes domain-specific setups, including event listener registrations.
"""
from django.apps import AppConfig


class RosterConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'roster'
    verbose_name = 'Roster & Logistics Management'

    def ready(self) -> None:
        """
        Bootstraps application dependencies.
        Registers Domain Event listeners (Signals) to maintain eventual consistency
        with the Identity and Access Management (IAM/Core) context.
        """
        import roster.signals  # noqa: F401