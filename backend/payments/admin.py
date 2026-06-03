# payments/admin.py
# ==========================================
# Payments & Donations — Django Admin
# Standard: Enterprise SaaS 2026
# ==========================================
from django.contrib import admin

from .models import Donation, PatronLead


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


@admin.register(PatronLead)
class PatronLeadAdmin(admin.ModelAdmin):
    """
    Hand-managed view onto patronage leads. `status` and `note` are the working
    fields the foundation advances as it contacts each prospective patron; the
    contact details the visitor supplied are immutable.
    """
    list_display = ('first_name', 'last_name', 'email', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('first_name', 'last_name', 'email')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_editable = ('status',)
    readonly_fields = ('id', 'first_name', 'last_name', 'email', 'created_at', 'updated_at')

    def has_add_permission(self, request) -> bool:
        # Leads originate only from the public Mecenat form (consent captured there);
        # a hand-created row would have no lawful basis recorded.
        return False
