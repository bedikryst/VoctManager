"""
@file plan.py
@description The plan and the budget's standing: kosztorys lines (add, edit,
             remove, reorder), charging costs that sit outside the plan to a
             line, and the three board acts that move a budget between
             PLANNING, APPROVED and CLOSED. The plan is editable while it is
             being planned; an approved plan is changed only after the board
             reopens it with a reason ("korekta kosztorysu"), and a closed
             budget changes not at all. Also the patron report's opening
             sentences, which are words about the concert rather than money.
@architecture Enterprise SaaS 2026
@module finance/services/plan
"""
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from roster.models import Project

from ..dtos import BudgetLineDTO, BudgetLineUpdateDTO, LineOrderDTO
from ..exceptions import BudgetHasOpenItems, BudgetTransitionRefused, LineOrderMismatch, PlanAmountTooLarge
from ..models import BudgetLine, BudgetStatus, CostItem, FinanceAction, ProjectBudget
from ..rules import MAX_AMOUNT, ZERO, planned_amount
from . import audit
from .budget import BudgetService
from .funding import assert_line_allocations_fit, release_line_allocations

_LINE_FIELDS = ("category", "name", "unit", "quantity", "unit_cost", "note")


def _line_snapshot(line: BudgetLine) -> dict[str, Any]:
    snapshot: dict[str, Any] = {name: getattr(line, name) for name in _LINE_FIELDS}
    snapshot["planned_amount"] = planned_amount(line.quantity, line.unit_cost)
    return snapshot


def _check_amount(line: BudgetLine) -> None:
    if planned_amount(line.quantity, line.unit_cost) > MAX_AMOUNT:
        raise PlanAmountTooLarge()


def _detach(budget: ProjectBudget, items: list[CostItem], *, actor: User | None) -> None:
    """Takes costs off a line that is leaving them — logged on each cost, so
    its own history says where its charge went."""
    for item in items:
        before = {"budget_line_id": item.budget_line_id}
        item.budget_line = None
        item.save(update_fields=["budget_line", "updated_at"])
        audit.record(
            budget, actor=actor, subject=item, action=FinanceAction.DETAILS_CHANGED,
            before=before, after={"budget_line_id": None},
        )


class PlanService:
    @staticmethod
    def create_line(project: Project, dto: BudgetLineDTO, *, actor: User | None) -> BudgetLine:
        """A new line goes to the end of its category."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_plan_editable(budget)
            last = BudgetLine.objects.filter(budget=budget).aggregate(last=Max("position"))["last"]
            line = BudgetLine(
                budget=budget,
                category=dto.category,
                name=dto.name,
                position=0 if last is None else last + 1,
                unit=dto.unit,
                quantity=dto.quantity,
                unit_cost=dto.unit_cost,
                note=dto.note,
            )
            _check_amount(line)
            line.save()
            audit.record(budget, actor=actor, subject=line, action=FinanceAction.CREATED, after=_line_snapshot(line))
            return line

    @staticmethod
    def update_line(line: BudgetLine, dto: BudgetLineUpdateDTO, *, actor: User | None) -> BudgetLine:
        """Changing a line's category takes its costs off it: a cost is charged
        to a line of its own category, and the costs did not change category."""
        with transaction.atomic():
            budget = BudgetService.lock(line.budget.project)
            BudgetService.assert_plan_editable(budget)
            line = BudgetLine.objects.select_for_update().get(pk=line.pk)
            requested = {name: getattr(dto, name) for name in dto.model_fields_set}
            changed = {name: value for name, value in requested.items() if getattr(line, name) != value}
            if not changed:
                return line
            before = _line_snapshot(line)
            for name, value in changed.items():
                setattr(line, name, value)
            _check_amount(line)
            assert_line_allocations_fit(line)
            line.save()
            if "category" in changed:
                _detach(budget, list(CostItem.objects.filter(budget_line=line)), actor=actor)
            audit.record(
                budget, actor=actor, subject=line, action=FinanceAction.PLAN_CHANGED,
                before=before, after=_line_snapshot(line),
            )
            return line

    @staticmethod
    def delete_line(line: BudgetLine, *, actor: User | None) -> None:
        """The line leaves the plan with its split between sources; the costs
        charged to it stay, outside the plan, charged to whatever they were."""
        with transaction.atomic():
            budget = BudgetService.lock(line.budget.project)
            BudgetService.assert_plan_editable(budget)
            line = BudgetLine.objects.select_for_update().get(pk=line.pk)
            release_line_allocations(budget, line, actor=actor)
            _detach(budget, list(CostItem.all_objects.filter(budget_line=line)), actor=actor)
            before = _line_snapshot(line)
            line.delete()
            audit.record(budget, actor=actor, subject=line, action=FinanceAction.REMOVED, before=before)

    @staticmethod
    def reorder(project: Project, dto: LineOrderDTO, *, actor: User | None) -> None:
        """Every line in its new order. Numbering follows the category first,
        so the order that shows is the order within each category."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_plan_editable(budget)
            lines = {line.pk: line for line in BudgetLine.objects.filter(budget=budget)}
            if set(dto.ids) != set(lines):
                raise LineOrderMismatch()
            before = [str(line.pk) for line in sorted(lines.values(), key=lambda line: line.position)]
            for position, line_id in enumerate(dto.ids):
                line = lines[line_id]
                if line.position != position:
                    line.position = position
                    line.save(update_fields=["position", "updated_at"])
            after = [str(line_id) for line_id in dto.ids]
            if before != after:
                audit.record(
                    budget, actor=actor, subject=budget, action=FinanceAction.PLAN_CHANGED,
                    before={"order": before}, after={"order": after},
                )

    @staticmethod
    def charge_unplanned(line: BudgetLine, *, actor: User | None) -> int:
        """Charges every cost of the line's category that sits outside the plan
        to this line — one act for the usual case of "all the singers' fees on
        Honoraria chórzystów". Unpriced fees have no cost yet and stay as they
        are. An act on the actuals, not on the plan, so it runs in an approved
        budget too. Answers how many costs it charged."""
        with transaction.atomic():
            budget = BudgetService.lock(line.budget.project)
            BudgetService.assert_writable(budget)
            line = BudgetLine.objects.get(pk=line.pk)
            items = list(
                CostItem.objects.select_for_update()
                .filter(budget=budget, category=line.category, budget_line__isnull=True, cost_amount__isnull=False)
            )
            for item in items:
                item.budget_line = line
                item.save(update_fields=["budget_line", "updated_at"])
                audit.record(
                    budget, actor=actor, subject=item, action=FinanceAction.DETAILS_CHANGED,
                    before={"budget_line_id": None}, after={"budget_line_id": line.pk},
                )
            return len(items)

    # ------------------------------------------------------------------ #
    # The budget's standing — the board's acts                            #
    # ------------------------------------------------------------------ #

    @staticmethod
    def approve(project: Project, *, actor: User | None) -> ProjectBudget:
        """PLANNING → APPROVED: the plan is agreed and locked. The event keeps
        the plan's total as it was approved."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            if budget.status != BudgetStatus.PLANNING:
                raise BudgetTransitionRefused(params={"status": budget.status, "action": "approve"})
            lines = list(BudgetLine.objects.filter(budget=budget))
            planned = sum((planned_amount(line.quantity, line.unit_cost) for line in lines), ZERO)
            budget.status = BudgetStatus.APPROVED
            budget.approved_at = timezone.now()
            budget.approved_by = actor
            budget.save(update_fields=["status", "approved_at", "approved_by", "updated_at"])
            audit.record(
                budget, actor=actor, subject=budget, action=FinanceAction.BUDGET_APPROVED,
                before={"status": BudgetStatus.PLANNING},
                after={"status": budget.status, "planned": planned, "lines": len(lines)},
            )
            return budget

    @staticmethod
    def reopen(project: Project, *, reason: str, actor: User | None) -> ProjectBudget:
        """One step back, with a reason: CLOSED → APPROVED reopens the books;
        APPROVED → PLANNING opens the plan for a correction."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            previous = budget.status
            if previous == BudgetStatus.CLOSED:
                budget.status = BudgetStatus.APPROVED
                budget.closed_at = None
                budget.closed_by = None
            elif previous == BudgetStatus.APPROVED:
                budget.status = BudgetStatus.PLANNING
                budget.approved_at = None
                budget.approved_by = None
            else:
                raise BudgetTransitionRefused(params={"status": previous, "action": "reopen"})
            budget.save(update_fields=[
                "status", "approved_at", "approved_by", "closed_at", "closed_by", "updated_at",
            ])
            audit.record(
                budget, actor=actor, subject=budget, action=FinanceAction.BUDGET_REOPENED,
                before={"status": previous}, after={"status": budget.status}, reason=reason,
            )
            return budget

    @staticmethod
    def close(project: Project, *, actor: User | None) -> ProjectBudget:
        """APPROVED → CLOSED: the books are settled and nothing changes any more.
        Refused while anything is left to settle — an unpaid cost, a person with
        no price, a fee that lost its seat, a mandate whose employer
        contributions the office has not reported (its cost would stay short of
        what left the foundation) — because a closed budget would keep it
        unsettled for good. The refusal says how much of each is left."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            if budget.status != BudgetStatus.APPROVED:
                raise BudgetTransitionRefused(params={"status": budget.status, "action": "close"})
            money = BudgetService.build(project)
            summary = money.summary
            contributions_missing = sum(
                len(warning.subject_ids) for warning in money.warnings if warning.code == "EMPLOYER_COST_MISSING"
            )
            if summary.outstanding > 0 or summary.unpriced or summary.orphaned or contributions_missing:
                raise BudgetHasOpenItems(params={
                    "outstanding": str(summary.outstanding),
                    "unpriced": summary.unpriced,
                    "orphaned": summary.orphaned,
                    "contributions_missing": contributions_missing,
                })
            budget.status = BudgetStatus.CLOSED
            budget.closed_at = timezone.now()
            budget.closed_by = actor
            budget.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
            audit.record(
                budget, actor=actor, subject=budget, action=FinanceAction.BUDGET_CLOSED,
                before={"status": BudgetStatus.APPROVED},
                after={"status": budget.status, "committed": summary.committed, "paid": summary.paid},
            )
            return budget

    @staticmethod
    def set_patron_summary(project: Project, text: str) -> ProjectBudget:
        """The sentences the patron report opens with. They describe the
        concert, not its money, so they are written in any state — a closed
        budget is exactly when the final report goes out — and not logged."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            budget.patron_summary = text
            budget.save(update_fields=["patron_summary", "updated_at"])
            return budget
