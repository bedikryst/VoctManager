# outreach/admin.py
# ==========================================
# Outreach — Django Admin
# Standard: Enterprise SaaS 2026
# ==========================================
from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from .models import ConcertNoticeSubscription, NoticeConsentEvent, NoticeStatus


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
    A register of consents, read-only in all but one field: every other column is either
    something the subscriber supplied as part of the consent or a fact about what they did.
    A hand-set `confirmed_at` would be a fabricated consent and a hand-typed address a
    consent nobody gave, so there is no add form and no way to reach either.

    `name` IS THE EXCEPTION, AND IT HAS TO BE. It is not evidence of anything — the model
    gives it one use, the greeting of the notice itself — so it is a preference, and § 8 of
    the privacy policy promises rectification of data that is incomplete as well as data
    that is wrong (art. 16). An address with no name is exactly the first case, and a
    register with no writable field at all could not honour a request to fix it.

    WHAT MAKES THAT LAWFUL IS THAT THE SUBSCRIBER ASKED. Typing in a name the office happens
    to know is not rectification; it is a second source of personal data arriving on a record
    the subscriber's own consent is supposed to govern. The self-service route
    (`NoticePreferencesView`, reached from the mail) is the one that needs no such judgement,
    and this field exists for the request that arrives by other means.

    The other lawful write from here is an erasure request (art. 17): delete the row.
    """
    list_display = ('email', 'status', 'locale', 'confirmed_at', 'clause_version', 'created_at')
    list_filter = ('status', 'locale', 'clause_version', 'created_at')
    search_fields = ('email',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    # `name` is absent from `list_display` and stays absent now that it is editable: an
    # access request is answered from the row, while the list is scanned over somebody's
    # shoulder — it carries no more of a person than the address that identifies them.
    readonly_fields = (
        'id', 'email', 'locale', 'status', 'clause_version', 'surface',
        'confirm_sent_at', 'confirmed_at', 'unsubscribed_at', 'created_at', 'updated_at',
    )
    # The two secrets are never shown: an unsubscribe token in a screenshot is a way to
    # end somebody else's subscription, and neither is of any use to a human reader.
    exclude = ('confirm_token', 'unsubscribe_token', 'is_deleted')
    inlines = [NoticeConsentEventInline]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        """
        Open, except on a withdrawn consent — which mirrors `NoticeListService.update_name`
        rather than merely resembling it. There is no letter left to greet, so a greeting
        written there would be personal data collected for a purpose that has ended; the row
        is waiting for `purge_notice_records`, not for enrichment.

        `obj is None` is the changelist asking whether the section is reachable at all, and
        that has to stay True or the rows become unopenable.
        """
        if obj is None:
            return True
        return bool(obj.status != NoticeStatus.UNSUBSCRIBED)
