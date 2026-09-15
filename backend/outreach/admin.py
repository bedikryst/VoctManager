# outreach/admin.py
# ==========================================
# Outreach — Django Admin
# Standard: Enterprise SaaS 2026
# ==========================================
from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from .models import ConcertNoticeSubscription, NoticeConsentEvent


class NoticeConsentEventInline(admin.TabularInline):
    """
    Every consent this address ever gave or withdrew, in one place — which is the point of
    the log: the subscription row above shows only the CURRENT state, and a re-subscription
    overwrites it. Read-only in every direction; an evidence log a person can type into is
    not evidence.
    """
    model = NoticeConsentEvent
    extra = 0
    can_delete = False
    fields = ('at', 'kind', 'clause_version', 'surface', 'locale')
    readonly_fields = fields

    def has_add_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(ConcertNoticeSubscription)
class ConcertNoticeSubscriptionAdmin(admin.ModelAdmin):
    """
    A read-only register of consents, which is what it has to be: every field on the row
    is either something the subscriber supplied or a fact about what they did. A hand-set
    `confirmed_at` would be a fabricated consent, and a hand-typed address would be a
    consent nobody gave — so there is no add form and nothing is editable.

    The one lawful write from here is an erasure request (art. 17): delete the row.
    """
    list_display = ('email', 'status', 'locale', 'confirmed_at', 'clause_version', 'created_at')
    list_filter = ('status', 'locale', 'clause_version', 'created_at')
    search_fields = ('email',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    # `name` is here and not in `list_display`: an access request is answered from the row,
    # while the list is scanned over somebody's shoulder — it carries no more of a person
    # than the address that identifies them.
    readonly_fields = (
        'id', 'email', 'name', 'locale', 'status', 'clause_version', 'surface',
        'confirm_sent_at', 'confirmed_at', 'unsubscribed_at', 'created_at', 'updated_at',
    )
    # The two secrets are never shown: an unsubscribe token in a screenshot is a way to
    # end somebody else's subscription, and neither is of any use to a human reader.
    exclude = ('confirm_token', 'unsubscribe_token', 'is_deleted')
    inlines = [NoticeConsentEventInline]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False
