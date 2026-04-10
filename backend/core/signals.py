# core/signals.py
from django.dispatch import Signal

# Enterprise Event: Emitted when a user account is soft-deleted (GDPR erasure or manual admin action)
account_soft_deleted = Signal()

user_pii_updated = Signal()

user_email_changed = Signal()