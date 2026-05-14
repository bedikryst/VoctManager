# payments/apps.py
# ==========================================
# Payments & Donations — App Configuration
# Standard: Enterprise SaaS 2026
# ==========================================
from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'payments'
    verbose_name = 'Payments & Donations'
