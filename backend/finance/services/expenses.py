"""
@file expenses.py
@description The write side of expenses — every cost that is not a person's
             fee: the venue, travel, printing, rights. An expense is booked from
             the vendor's document, and its cost is that document's gross,
             entered directly: the foundation recovers no VAT. The rules match
             the fee ledger's: a closed budget takes nothing, a paid expense
             keeps its amount and vendor until the board reverts the payment,
             and every change is logged. Paying and reverting a payment go
             through the ledger service, as for fees.
@architecture Enterprise SaaS 2026
@module finance/services/expenses
"""
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction

from roster.models import Project

from ..dtos import ExpenseDTO, ExpenseUpdateDTO
from ..exceptions import ItemPaid, PaidItemNotRemovable
from ..models import CostItem, CostKind, FinanceAction
from ..rules import local_date, money
from . import audit
from .budget import BudgetService, reconcile_line_change
from .funding import assert_allocations_fit, release_cost_allocations

# What a paid expense keeps: the amount the office paid and whom it paid.
_FROZEN_WHEN_PAID = frozenset({"cost_amount", "vendor_name"})
# Text fields a client clears by sending null.
_TEXT_FIELDS = frozenset({"vendor_nip", "document_number", "description", "note"})


def _snapshot(item: CostItem) -> dict[str, Any]:
    return {
        "vendor_name": item.vendor_name,
        "category": item.category,
        "document_type": item.document_type,
        "document_number": item.document_number,
        "cost_amount": item.cost_amount,
        "budget_line": item.budget_line_id,
    }


class ExpenseService:
    @staticmethod
    def create(project: Project, dto: ExpenseDTO, *, actor: User | None) -> CostItem:
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)
            line = BudgetService.resolve_line(budget, dto.budget_line, dto.category)
            item = CostItem(
                budget=budget,
                kind=CostKind.EXPENSE,
                category=dto.category,
                budget_line=line,
                cost_amount=money(dto.cost_amount),
                incurred_on=(
                    dto.incurred_on or dto.document_date or local_date(project.date_time, project.timezone)
                ),
                due_on=dto.due_on,
                note=dto.note,
                vendor_name=dto.vendor_name,
                vendor_nip=dto.vendor_nip,
                document_type=dto.document_type,
                document_number=dto.document_number,
                document_date=dto.document_date,
                description=dto.description,
            )
            item.save()
            audit.record(budget, actor=actor, subject=item, action=FinanceAction.CREATED, after=_snapshot(item))
            return item

    @staticmethod
    def update(item: CostItem, dto: ExpenseUpdateDTO, *, actor: User | None) -> CostItem:
        """Only the fields sent change. A new category takes the expense off a
        line of its old category, unless a line of the new one is sent with it."""
        with transaction.atomic():
            budget = BudgetService.lock(item.budget.project)
            BudgetService.assert_writable(budget)
            item = CostItem.objects.select_for_update().get(pk=item.pk)

            requested: dict[str, Any] = {}
            for name in dto.model_fields_set:
                value = getattr(dto, name)
                if name == "budget_line":
                    name = "budget_line_id"
                elif name in _TEXT_FIELDS and value is None:
                    value = ""
                elif name == "cost_amount" and value is not None:
                    value = money(value)
                requested[name] = value
            changed = {name: value for name, value in requested.items() if getattr(item, name) != value}
            if not changed:
                return item

            frozen = sorted(changed.keys() & _FROZEN_WHEN_PAID)
            if frozen and item.paid_on is not None:
                raise ItemPaid(params={"fields": frozen})

            reconcile_line_change(budget, item, changed)

            before = {name: getattr(item, name) for name in changed}
            for name, value in changed.items():
                setattr(item, name, value)
            if "cost_amount" in changed:
                assert_allocations_fit(item)
            item.save()
            audit.record(
                budget, actor=actor, subject=item,
                action=FinanceAction.PRICED if "cost_amount" in changed else FinanceAction.DETAILS_CHANGED,
                before=before, after=changed,
            )
            return item

    @staticmethod
    def delete(item: CostItem, *, actor: User | None) -> None:
        """A mistaken entry leaves the budget, and every source it was charged
        to. A paid one is an accounting record and stays until the board
        reverts the payment. Its files stay with it."""
        with transaction.atomic():
            budget = BudgetService.lock(item.budget.project)
            BudgetService.assert_writable(budget)
            item = CostItem.objects.select_for_update().get(pk=item.pk)
            if item.paid_on is not None:
                raise PaidItemNotRemovable()
            release_cost_allocations(budget, item, actor=actor)
            before = _snapshot(item)
            item.delete()
            audit.record(budget, actor=actor, subject=item, action=FinanceAction.REMOVED, before=before)
