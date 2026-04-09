# core/signals.py
import django.dispatch

# Enterprise Event: Emitted when a user account is soft-deleted (GDPR erasure or manual admin action)
account_soft_deleted = django.dispatch.Signal()