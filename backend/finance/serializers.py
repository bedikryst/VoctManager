"""
@file serializers.py
@description Output shapes of the finance API. Read-only by construction: every
             write goes through a DTO into a service, so nothing here validates
             input. Amounts leave as decimal strings ("1250.00") — a float
             would lose the grosz before the client ever sees it.
@architecture Enterprise SaaS 2026
@module finance/serializers
"""
from typing import Any

from rest_framework import serializers


def _amount(*, allow_null: bool = False) -> serializers.DecimalField:
    return serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True, allow_null=allow_null)


def _hours(*, allow_null: bool = False) -> serializers.DecimalField:
    return serializers.DecimalField(max_digits=6, decimal_places=2, coerce_to_string=True, allow_null=allow_null)


def _pct(**kwargs: Any) -> serializers.DecimalField:
    """A percentage, or null where there is nothing to measure it on. Wider
    than a rule's 0 to 100: a measured share can fall below zero when the plan
    expects more of a source than the whole plan costs (`rules.share_pct`
    bounds it to this width)."""
    return serializers.DecimalField(max_digits=9, decimal_places=2, coerce_to_string=True, allow_null=True, **kwargs)


class AllocationSerializer(serializers.Serializer):
    funding_id = serializers.UUIDField()
    amount = _amount()


class ContractSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    form = serializers.CharField()
    amount = _amount()
    status = serializers.CharField()
    issued_at = serializers.DateTimeField()
    signed_on = serializers.DateField(allow_null=True)
    signed_copy_location = serializers.CharField(allow_blank=True)
    hours_confirmed = _hours(allow_null=True)


class LedgerRowSerializer(serializers.Serializer):
    key = serializers.UUIDField()
    origin = serializers.CharField()
    participation_id = serializers.UUIDField(allow_null=True)
    crew_assignment_id = serializers.UUIDField(allow_null=True)
    cost_item_id = serializers.UUIDField(allow_null=True)
    payee_name = serializers.CharField(allow_blank=True)
    payee_role = serializers.CharField(allow_blank=True)
    seat_status = serializers.CharField(allow_null=True)
    billable = serializers.BooleanField()
    orphaned = serializers.BooleanField()
    counted = serializers.BooleanField()
    is_priced = serializers.BooleanField()
    is_paid = serializers.BooleanField()
    category = serializers.CharField(allow_blank=True)
    budget_line_id = serializers.UUIDField(allow_null=True)
    form = serializers.CharField(allow_blank=True)
    default_form = serializers.CharField(allow_null=True)
    contract_amount = _amount(allow_null=True)
    employer_contributions = _amount(allow_null=True)
    cost_amount = _amount(allow_null=True)
    in_kind_hours = _hours(allow_null=True)
    in_kind_hourly_rate = _amount(allow_null=True)
    in_kind_value = _amount(allow_null=True)
    incurred_on = serializers.DateField()
    due_on = serializers.DateField(allow_null=True)
    paid_on = serializers.DateField(allow_null=True)
    paid_marked_at = serializers.DateTimeField(allow_null=True)
    document_number = serializers.CharField(allow_blank=True)
    document_date = serializers.DateField(allow_null=True)
    vendor_nip = serializers.CharField(allow_blank=True)
    note = serializers.CharField(allow_blank=True)
    contract = ContractSerializer(allow_null=True)
    allocations = AllocationSerializer(many=True)
    allocated = _amount()
    allocatable = _amount()
    unallocated = _amount()


class AttachmentSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    original_name = serializers.CharField()
    mime_type = serializers.CharField()
    size_bytes = serializers.IntegerField()
    uploaded_at = serializers.DateTimeField()


class ExpenseRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    category = serializers.CharField()
    budget_line_id = serializers.UUIDField(allow_null=True)
    vendor_name = serializers.CharField()
    vendor_nip = serializers.CharField(allow_blank=True)
    document_type = serializers.CharField(allow_blank=True)
    document_number = serializers.CharField(allow_blank=True)
    document_date = serializers.DateField(allow_null=True)
    description = serializers.CharField(allow_blank=True)
    cost_amount = _amount()
    incurred_on = serializers.DateField()
    due_on = serializers.DateField(allow_null=True)
    paid_on = serializers.DateField(allow_null=True)
    paid_marked_at = serializers.DateTimeField(allow_null=True)
    is_paid = serializers.BooleanField()
    note = serializers.CharField(allow_blank=True)
    attachments = AttachmentSerializer(many=True)
    allocations = AllocationSerializer(many=True)
    allocated = _amount()
    unallocated = _amount()


class PlanLineSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    section = serializers.CharField()
    category = serializers.CharField()
    name = serializers.CharField()
    position = serializers.IntegerField()
    unit = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=8, decimal_places=2, coerce_to_string=True)
    unit_cost = _amount()
    planned_amount = _amount()
    note = serializers.CharField(allow_blank=True)
    actual = _amount()
    paid = _amount()
    cost_count = serializers.IntegerField()
    over_plan = serializers.BooleanField()
    allocations = AllocationSerializer(many=True)
    allocated = _amount()
    unallocated = _amount()
    tolerance_pct = _pct()
    over_tolerance = serializers.BooleanField()


class SourceFiguresSerializer(serializers.Serializer):
    """A source across every project it funds (`services/sources.py`)."""

    project_count = serializers.IntegerField()
    planned = _amount()
    received = _amount()
    line_allocated = _amount()
    charged = _amount()
    ceiling = _amount(allow_null=True)
    remaining = _amount(allow_null=True)
    over_awarded = serializers.BooleanField()
    own_share_plan_pct = _pct()
    own_share_actual_pct = _pct()
    own_share_below = serializers.BooleanField()
    admin_plan_pct = _pct()
    admin_actual_pct = _pct()
    admin_cap_exceeded = serializers.BooleanField()


class SourceSerializer(serializers.Serializer):
    """A funding source with its rules and its figures, from a `SourceView`."""

    id = serializers.UUIDField(source="source.pk")
    kind = serializers.CharField(source="source.kind")
    name = serializers.CharField(source="source.name")
    grantor = serializers.CharField(source="source.grantor", allow_blank=True)
    agreement_number = serializers.CharField(source="source.agreement_number", allow_blank=True)
    agreement_date = serializers.DateField(source="source.agreement_date", allow_null=True)
    awarded_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=True, allow_null=True, source="source.awarded_amount",
    )
    status = serializers.CharField(source="source.status")
    eligible_from = serializers.DateField(source="source.eligible_from", allow_null=True)
    eligible_to = serializers.DateField(source="source.eligible_to", allow_null=True)
    report_due_on = serializers.DateField(source="source.report_due_on", allow_null=True)
    required_own_share_pct = _pct(source="source.required_own_share_pct")
    admin_cost_cap_pct = _pct(source="source.admin_cost_cap_pct")
    line_tolerance_pct = _pct(source="source.line_tolerance_pct")
    document_note_template = serializers.CharField(source="source.document_note_template")
    note = serializers.CharField(source="source.note", allow_blank=True)
    brings_money = serializers.BooleanField(source="source.brings_money")
    figures = SourceFiguresSerializer()


def _with_source(data: Any, view: Any) -> dict[str, Any]:
    """Adds the nested `source`. A declared field cannot carry that name: it
    would shadow `Field.source`, the attribute every serializer field reads."""
    payload = dict(data)
    payload["source"] = SourceSerializer(view).data
    return payload


class FundingSerializer(serializers.Serializer):
    """A source on this project (with the nested `source`). `charge_limit` is
    what the source may carry of the project's costs; the three flags say
    which limit is passed."""

    id = serializers.UUIDField()
    planned_amount = _amount()
    received_amount = _amount()
    line_allocated = _amount()
    charged = _amount()
    charged_count = serializers.IntegerField()
    charge_limit = _amount()
    brings_money = serializers.BooleanField()
    over_plan_allocation = serializers.BooleanField()
    over_charge_limit = serializers.BooleanField()
    overallocated = serializers.BooleanField()

    def to_representation(self, instance: Any) -> dict[str, Any]:
        return _with_source(super().to_representation(instance), instance.source)


class FundingSummarySerializer(serializers.Serializer):
    planned = _amount()
    received = _amount()
    charged = _amount()
    uncovered = _amount()
    in_kind_planned = _amount()
    in_kind_contributed = _amount()
    plan_uncovered = _amount(allow_null=True)


class CategoryTotalSerializer(serializers.Serializer):
    category = serializers.CharField()
    committed = _amount()
    paid = _amount()


class TotalsSerializer(serializers.Serializer):
    committed = _amount()
    paid = _amount()
    outstanding = _amount()


class SummarySerializer(serializers.Serializer):
    """What the project card and the overview read: committed is every counted
    cost — fees and expenses — outstanding is what of it is not yet paid, and
    `fees`/`expenses` split both. In-kind is the value of volunteer work (never
    a cost); planned is the plan's total, null while there is no plan."""

    committed = _amount()
    paid = _amount()
    outstanding = _amount()
    in_kind = _amount()
    fees = TotalsSerializer()
    expenses = TotalsSerializer()
    planned = _amount(allow_null=True)
    unplanned = _amount()
    by_category = CategoryTotalSerializer(many=True)
    rows = serializers.IntegerField()
    priced = serializers.IntegerField()
    unpriced = serializers.IntegerField()
    paid_count = serializers.IntegerField()
    orphaned = serializers.IntegerField()
    volunteers = serializers.IntegerField()
    expense_count = serializers.IntegerField()
    lines = serializers.IntegerField()


class WarningSerializer(serializers.Serializer):
    code = serializers.CharField()
    severity = serializers.CharField()
    subject_ids = serializers.ListField(child=serializers.UUIDField())
    params = serializers.DictField()


class BudgetProjectSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    date_time = serializers.DateTimeField()
    timezone = serializers.CharField()
    status = serializers.CharField()


class BudgetStateSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    approved_at = serializers.DateTimeField(allow_null=True)
    closed_at = serializers.DateTimeField(allow_null=True)
    internal_note = serializers.CharField(allow_blank=True)
    patron_summary = serializers.CharField(allow_blank=True)


class ProjectMoneySerializer(serializers.Serializer):
    """`GET projects/{id}/budget/` and the answer to every ledger write: the
    whole budget, so a client never patches its copy row by row."""

    project = BudgetProjectSerializer()
    budget = BudgetStateSerializer(allow_null=True)
    summary = SummarySerializer()
    funding = FundingSummarySerializer()
    warnings = WarningSerializer(many=True)
    ledger = LedgerRowSerializer(many=True, source="rows")
    expenses = ExpenseRowSerializer(many=True)
    lines = PlanLineSerializer(many=True)
    fundings = FundingSerializer(many=True)


class WarningCountsSerializer(serializers.Serializer):
    work = serializers.IntegerField()
    problem = serializers.IntegerField()


class ProjectRollupSerializer(serializers.Serializer):
    project = BudgetProjectSerializer()
    budget_status = serializers.CharField()
    summary = SummarySerializer()
    warning_counts = WarningCountsSerializer()


class PayableSerializer(serializers.Serializer):
    """A fee names its payee; an expense its vendor and what it paid for.
    `paid_on` is set on the paid list only."""

    cost_item_id = serializers.UUIDField(source="pk")
    kind = serializers.CharField()
    project_id = serializers.UUIDField(source="budget.project_id")
    project_title = serializers.CharField(source="budget.project.title")
    project_date_time = serializers.DateTimeField(source="budget.project.date_time")
    payee_name = serializers.CharField(allow_blank=True)
    payee_role = serializers.CharField(allow_blank=True)
    vendor_name = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    category = serializers.CharField()
    form = serializers.CharField(allow_blank=True)
    cost_amount = _amount(allow_null=True)
    incurred_on = serializers.DateField()
    due_on = serializers.DateField(allow_null=True)
    paid_on = serializers.DateField(allow_null=True)


class PayablesPageSerializer(serializers.Serializer):
    """`GET payables/`: one page, and the count and sum of the whole filtered
    set, so a footer never sums only what is on screen."""

    count = serializers.IntegerField()
    limit = serializers.IntegerField()
    offset = serializers.IntegerField()
    total_amount = _amount()
    results = PayableSerializer(many=True)


class PayablesSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    total = _amount()
    overdue_count = serializers.IntegerField()
    overdue_total = _amount()
    due_soon_count = serializers.IntegerField()
    due_soon_total = _amount()


class SourceProjectSerializer(serializers.Serializer):
    funding_id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    project_title = serializers.CharField()
    project_date_time = serializers.DateTimeField()
    budget_status = serializers.CharField()
    planned_amount = _amount()
    received_amount = _amount()
    line_allocated = _amount()
    charged = _amount()


class SourceChargeSerializer(serializers.Serializer):
    cost_item_id = serializers.UUIDField()
    kind = serializers.CharField()
    project_id = serializers.UUIDField()
    project_title = serializers.CharField()
    payee_name = serializers.CharField(allow_blank=True)
    vendor_name = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    category = serializers.CharField()
    plan_line = serializers.CharField(allow_blank=True)
    document_number = serializers.CharField(allow_blank=True)
    incurred_on = serializers.DateField()
    paid_on = serializers.DateField(allow_null=True)
    cost_amount = _amount()
    amount = _amount()
    eligible = serializers.BooleanField()


class SourceDetailSerializer(serializers.Serializer):
    """`GET funding-sources/{id}/`: the source (the nested `source`), the
    projects it funds and every cost charged to it — what its settlement
    reports."""

    projects = SourceProjectSerializer(many=True)
    charges = SourceChargeSerializer(many=True)

    def to_representation(self, instance: Any) -> dict[str, Any]:
        return _with_source(super().to_representation(instance), instance.view)


class HistoryEventSerializer(serializers.Serializer):
    """One act in the budget's history. `subject_label` names what it was about
    as the record has it now — a payee, a vendor, a contract number, a line."""

    id = serializers.UUIDField()
    at = serializers.DateTimeField()
    action = serializers.CharField()
    subject_type = serializers.CharField()
    subject_id = serializers.UUIDField()
    subject_label = serializers.CharField(allow_blank=True)
    actor_name = serializers.CharField(allow_blank=True)
    before = serializers.DictField()
    after = serializers.DictField()
    reason = serializers.CharField(allow_blank=True)
