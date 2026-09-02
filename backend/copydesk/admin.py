"""
Copy desk admin.

Read-mostly on purpose. `CopySegment` is a mirror of the repository: editing a
value here would change what the desk shows without changing what the site
serves, and the next extraction would silently undo it. Proposals are worked in
the desk itself, where a reviewer can see the Polish beside them; the admin is
for looking, and for the one operational escape hatch — reversing an `applied_at`
stamp when a commit was rolled back.
"""

from django.contrib import admin
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _

from .models import CopyProposal, CopySegment


@admin.register(CopySegment)
class CopySegmentAdmin(admin.ModelAdmin):
    list_display = ('key', 'locale', 'kind', 'scope_label', 'order', 'excerpt', 'is_deleted')
    list_filter = ('locale', 'kind', 'is_deleted', 'scope')
    search_fields = ('key', 'label', 'scope_label', 'value')
    ordering = ('scope', 'order', 'key', 'locale')
    readonly_fields = (
        'id', 'key', 'locale', 'kind', 'value', 'source_hash',
        'scope', 'scope_label', 'label', 'order', 'created_at', 'updated_at',
    )

    @admin.display(description=_("Value"))
    def excerpt(self, obj: CopySegment) -> str:
        return obj.value[:70] + ("…" if len(obj.value) > 70 else "")

    def has_add_permission(self, request: HttpRequest) -> bool:
        # Segments come from the extractor reading the repository. A hand-made
        # row would name a field that does not exist on the site.
        return False


@admin.register(CopyProposal)
class CopyProposalAdmin(admin.ModelAdmin):
    list_display = ('segment', 'status', 'author', 'updated_at', 'notified_at', 'applied_at')
    list_filter = ('status', 'segment__locale', 'is_deleted')
    search_fields = ('segment__key', 'value', 'comment', 'author__email')
    ordering = ('-created_at',)
    raw_id_fields = ('segment', 'author', 'reviewed_by')
    readonly_fields = (
        'id', 'segment', 'value', 'source_hash', 'author', 'comment',
        'notified_at', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
    )
    fields = (*readonly_fields, 'status', 'applied_at')

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False
