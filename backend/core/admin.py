"""
Core admin.

`UserProfile` has no standalone entry on purpose: it is preferences *of* a
person and is meaningless detached from one, so it is edited as an inline on the
account. That composition lives in `roster.admin`, the layer allowed to know
about both the account and the choral profile — core must not import from it.

`FeedbackReport` is registered here because it is core-owned and composes with
nothing: it is a flat intake queue, worked in place.
"""

from typing import Any

from django.contrib import admin
from django.http import HttpRequest
from django.utils.html import format_html, format_html_join
from django.utils.safestring import SafeString
from django.utils.translation import gettext_lazy as _

from .models import FeedbackReport

_CONTEXT_ROW = (
    '<tr><th style="text-align:left;padding:2px 12px 2px 0;vertical-align:top;'
    'white-space:nowrap">{}</th>'
    '<td style="padding:2px 0"><pre style="margin:0;white-space:pre-wrap;'
    'word-break:break-word">{}</pre></td></tr>'
)


@admin.register(FeedbackReport)
class FeedbackReportAdmin(admin.ModelAdmin):
    """
    Triage queue for in-app reports. `status` and `note` are the working fields;
    everything the reporter and their browser supplied is immutable — a report is
    evidence of a moment, and editing it destroys the only record of that moment.
    """
    list_display = ('created_at', 'kind', 'status', 'reporter', 'route', 'excerpt')
    list_filter = ('status', 'kind', 'created_at')
    list_editable = ('status',)
    search_fields = ('body', 'route', 'reporter__email', 'reporter__first_name', 'reporter__last_name')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_select_related = ('reporter',)
    readonly_fields = ('id', 'reporter', 'kind', 'body', 'route', 'context_table', 'created_at', 'updated_at')
    fields = ('id', 'created_at', 'reporter', 'kind', 'body', 'route', 'context_table', 'status', 'note')

    @admin.display(description=_("Report"))
    def excerpt(self, obj: FeedbackReport) -> str:
        return obj.body[:80] + ("…" if len(obj.body) > 80 else "")

    @admin.display(description=_("Client context"))
    def context_table(self, obj: FeedbackReport) -> SafeString:
        """Renders the captured environment as a table — the raw JSON widget is
        unreadable on the phone this queue is most often triaged from."""
        context: dict[str, Any] = obj.context or {}
        if not context:
            return format_html("<em>{}</em>", _("No context captured."))

        rows = format_html_join(
            "\n",
            _CONTEXT_ROW,
            ((key.replace("_", " "), str(value)) for key, value in context.items()),
        )
        return format_html('<table style="border-collapse:collapse">{}</table>', rows)

    def has_add_permission(self, request: HttpRequest) -> bool:
        # Reports originate only from the in-app widget, which stamps the client
        # context; a hand-created row would be a report about nothing.
        return False
