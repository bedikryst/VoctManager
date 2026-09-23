"""
@file admin.py
@description The ledger in the admin: for reading, never for writing. Every
             change to a budget, an item or a contract goes through the finance
             services, which enforce the paid and contract locks and log the
             act; an admin edit would do neither. The database's check
             constraints hold either way.
@architecture Enterprise SaaS 2026
@module finance/admin
"""
from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from .models import (
    BudgetLine,
    Contract,
    ContractSequence,
    CostAllocation,
    CostItem,
    FinanceAttachment,
    FinanceEvent,
    FundingSource,
    LineAllocation,
    ProjectBudget,
    ProjectFunding,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(ProjectBudget)
class ProjectBudgetAdmin(ReadOnlyAdmin):
    list_display = ('project', 'status', 'approved_at', 'closed_at')
    list_filter = ('status',)
    search_fields = ('project__title',)


@admin.register(BudgetLine)
class BudgetLineAdmin(ReadOnlyAdmin):
    list_display = ('name', 'budget', 'category', 'quantity', 'unit', 'unit_cost', 'position', 'is_deleted')
    list_filter = ('category', 'is_deleted')
    search_fields = ('name', 'budget__project__title')

    def get_queryset(self, request: HttpRequest) -> Any:
        return BudgetLine.all_objects.select_related('budget__project')


@admin.register(CostItem)
class CostItemAdmin(ReadOnlyAdmin):
    list_display = (
        'payee_name', 'vendor_name', 'budget', 'kind', 'form', 'contract_amount', 'cost_amount', 'paid_on',
        'is_deleted',
    )
    list_filter = ('kind', 'form', 'category', 'is_deleted')
    search_fields = ('payee_name', 'vendor_name', 'budget__project__title', 'document_number')

    def get_queryset(self, request: HttpRequest) -> Any:
        # Soft-deleted items (a released crew fee, a removed expense) are part
        # of the record.
        return CostItem.all_objects.select_related('budget__project')


@admin.register(FinanceAttachment)
class FinanceAttachmentAdmin(ReadOnlyAdmin):
    # No link to the file: the admin would hand out its media URL, which nginx
    # refuses; the finance download view is the way to the file.
    list_display = ('original_name', 'cost_item', 'mime_type', 'size_bytes', 'created_at', 'is_deleted')
    list_filter = ('mime_type', 'is_deleted')
    exclude = ('file',)

    def get_queryset(self, request: HttpRequest) -> Any:
        return FinanceAttachment.all_objects.select_related('cost_item')


@admin.register(FundingSource)
class FundingSourceAdmin(ReadOnlyAdmin):
    list_display = ('name', 'kind', 'status', 'awarded_amount', 'eligible_from', 'eligible_to', 'report_due_on',
                    'is_deleted')
    list_filter = ('kind', 'status', 'is_deleted')
    search_fields = ('name', 'grantor', 'agreement_number')

    def get_queryset(self, request: HttpRequest) -> Any:
        return FundingSource.all_objects.all()


@admin.register(ProjectFunding)
class ProjectFundingAdmin(ReadOnlyAdmin):
    list_display = ('source', 'budget', 'planned_amount', 'received_amount', 'is_deleted')
    list_filter = ('is_deleted',)
    search_fields = ('source__name', 'budget__project__title')

    def get_queryset(self, request: HttpRequest) -> Any:
        return ProjectFunding.all_objects.select_related('source', 'budget__project')


@admin.register(LineAllocation)
class LineAllocationAdmin(ReadOnlyAdmin):
    list_display = ('budget_line', 'project_funding', 'amount', 'is_deleted')
    list_filter = ('is_deleted',)

    def get_queryset(self, request: HttpRequest) -> Any:
        return LineAllocation.all_objects.select_related('budget_line', 'project_funding__source')


@admin.register(CostAllocation)
class CostAllocationAdmin(ReadOnlyAdmin):
    list_display = ('cost_item', 'project_funding', 'amount', 'is_deleted')
    list_filter = ('is_deleted',)

    def get_queryset(self, request: HttpRequest) -> Any:
        return CostAllocation.all_objects.select_related('cost_item', 'project_funding__source')


@admin.register(Contract)
class ContractAdmin(ReadOnlyAdmin):
    list_display = ('number', 'payee_name', 'form', 'amount', 'status', 'issued_at', 'signed_on')
    list_filter = ('form', 'status')
    search_fields = ('number', 'payee_name')


@admin.register(ContractSequence)
class ContractSequenceAdmin(ReadOnlyAdmin):
    list_display = ('year', 'form', 'last_number')


@admin.register(FinanceEvent)
class FinanceEventAdmin(ReadOnlyAdmin):
    list_display = ('at', 'action', 'subject_type', 'subject_id', 'actor', 'budget')
    list_filter = ('action', 'subject_type')
    search_fields = ('subject_id', 'reason', 'budget__project__title')
