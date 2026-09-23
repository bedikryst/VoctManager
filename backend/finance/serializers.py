"""
@file serializers.py
@description Output shapes of the finance API. Read-only by construction: every
             write goes through a DTO into a service, so nothing here validates
             input. Amounts leave as decimal strings ("1250.00") — a float
             would lose the grosz before the client ever sees it.
@architecture Enterprise SaaS 2026
@module finance/serializers
"""
from rest_framework import serializers


def _amount(*, allow_null: bool = False) -> serializers.DecimalField:
    return serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True, allow_null=allow_null)


def _hours(*, allow_null: bool = False) -> serializers.DecimalField:
    return serializers.DecimalField(max_digits=6, decimal_places=2, coerce_to_string=True, allow_null=allow_null)


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
    warnings = WarningSerializer(many=True)
    ledger = LedgerRowSerializer(many=True, source="rows")
    expenses = ExpenseRowSerializer(many=True)
    lines = PlanLineSerializer(many=True)


class WarningCountsSerializer(serializers.Serializer):
    work = serializers.IntegerField()
    problem = serializers.IntegerField()


class ProjectRollupSerializer(serializers.Serializer):
    project = BudgetProjectSerializer()
    budget_status = serializers.CharField()
    summary = SummarySerializer()
    warning_counts = WarningCountsSerializer()


class PayableSerializer(serializers.Serializer):
    """A fee names its payee; an expense its vendor and what it paid for."""

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
