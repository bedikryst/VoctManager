"""
Support admin.

The agent's runs appear on the report they took up, as a read-only inline, and
the report list gains an action that runs the agent again. Composed here rather
than in `core` because support is the layer that knows both sides; core must not
import from it. The runs also have a list of their own, for outcomes and spend
across reports. Nothing here edits a run: a run is a record of what was sent.
"""

from typing import Any

from django.conf import settings
from django.contrib import admin, messages
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from core.admin import FeedbackReportAdmin
from core.models import FeedbackReport

from .models import SupportRun
from .tasks import queue_manual_run

_RUN_COLUMNS = ('started_at', 'trigger', 'result', 'action', 'channel', 'cost_usd', 'tool_rounds', 'elapsed_seconds')


class SupportRunInline(admin.TabularInline):
    model = SupportRun
    fk_name = 'report'
    extra = 0
    can_delete = False
    show_change_link = True
    fields = _RUN_COLUMNS
    readonly_fields = _RUN_COLUMNS
    ordering = ('started_at',)

    def has_add_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


admin.site.unregister(FeedbackReport)


@admin.register(FeedbackReport)
class FeedbackReportWithAgentAdmin(FeedbackReportAdmin):
    """The triage queue, with what the agent did on each report."""
    inlines = [SupportRunInline]
    actions = ['run_agent_again']

    @admin.action(description=_("Run the support agent again"))
    def run_agent_again(self, request: HttpRequest, queryset: QuerySet[FeedbackReport]) -> None:
        if not settings.ANTHROPIC_API_KEY:
            self.message_user(request, _("No Anthropic key is configured, so the agent cannot run."), messages.ERROR)
            return
        reports = list(queryset)
        for report in reports:
            queue_manual_run(report)
        self.message_user(
            request,
            ngettext(
                "The agent is queued for %(count)d report. Its outcome arrives by e-mail and in the note.",
                "The agent is queued for %(count)d reports. Their outcomes arrive by e-mail and in the notes.",
                len(reports),
            ) % {'count': len(reports)},
            messages.SUCCESS,
        )


@admin.register(SupportRun)
class SupportRunAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'report', 'trigger', 'result', 'action', 'channel', 'cost_usd', 'tool_rounds')
    list_filter = ('result', 'trigger', 'action', 'started_at')
    search_fields = ('report__body', 'reply', 'developer_note')
    ordering = ('-started_at',)
    date_hierarchy = 'started_at'
    list_select_related = ('report',)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False
