# payments/admin.py
# ==========================================
# Payments & Donations — Django Admin
# Standard: Enterprise SaaS 2026
# ==========================================
from django.contrib import admin

from .models import Donation


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    """
    Read-mostly view onto donations. Financial fields are immutable from the
    admin — a Donation's amount/currency originate from the gateway flow and
    must never be hand-edited. `status` is left editable as the sole escape
    hatch for manual reconciliation (e.g. a webhook that never arrived).
    """
    list_display = ('id', 'email', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('status', 'currency', 'created_at')
    search_fields = ('id', 'email', 'axepta_payment_id')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    readonly_fields = (
        'id', 'email', 'amount', 'currency', 'axepta_payment_id',
        'created_at', 'updated_at',
    )

    def has_add_permission(self, request) -> bool:
        # Donations originate only from the public API + gateway flow; a
        # hand-created row would have no corresponding Axepta transaction.
        return False
