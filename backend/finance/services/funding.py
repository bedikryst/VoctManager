"""
@file funding.py
@description The write side of funding: the organisation's funding sources, the
             sources a project counts on (what it expects of each, what has
             arrived), and the two splits — a plan line between the sources
             meant to cover it, an actual cost between the sources it is
             charged to. Whatever part of an amount no source covers is the
             foundation's own; it is reported, never assigned silently. The
             plan's split changes while the plan does; charging costs is an act
             on the actuals, open until the budget closes; what is charged to a
             settled source no longer changes at all. Every change is logged.
@architecture Enterprise SaaS 2026
@module finance/services/funding
"""
from collections.abc import Iterable
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import QuerySet

from roster.models import Participation, Project

from ..dtos import (
    AllocationSetDTO,
    ChargeCostsDTO,
    FundingSourceDTO,
    FundingSourceUpdateDTO,
    ProjectFundingDTO,
    ProjectFundingUpdateDTO,
)
from ..exceptions import (
    AllocationExceedsAmount,
    AllocationKindMismatch,
    AllocationNotCounted,
    ChargeRefused,
    EligibilityPeriodInvalid,
    FundingExists,
    FundingInUse,
    SourceInUse,
    SourceKindInUse,
    SourceSettled,
    UnknownFunding,
    UnknownSource,
)
from ..models import (
    DEFAULT_DOCUMENT_NOTE_TEMPLATE,
    BudgetLine,
    CostAllocation,
    CostItem,
    FinanceAction,
    FundingSource,
    FundingStatus,
    LineAllocation,
    ProjectBudget,
    ProjectFunding,
)
from ..rules import (
    ZERO,
    allocatable_amount,
    in_kind_value,
    is_valuation,
    money,
    planned_amount,
    source_accepts,
)
from . import audit
from .budget import BudgetService

_SOURCE_FIELDS = (
    "kind", "name", "grantor", "agreement_number", "agreement_date", "awarded_amount", "status",
    "eligible_from", "eligible_to", "report_due_on", "required_own_share_pct", "admin_cost_cap_pct",
    "line_tolerance_pct", "document_note_template", "note",
)
# Text fields a client clears by sending null.
_SOURCE_TEXT_FIELDS = frozenset({"grantor", "agreement_number", "note"})
# What a settled source still lets change: reopening it, and its note.
_SETTLED_SOURCE_EDITABLE = frozenset({"status", "note"})
# What a settled source's report printed of each cost charged to it.
SETTLED_COST_FIELDS = frozenset({"cost_amount", "category", "budget_line_id", "incurred_on"})

Allocation = LineAllocation | CostAllocation


def _allocation_snapshot(allocations: Iterable[Allocation]) -> list[dict[str, Any]]:
    """The split as the log keeps it: each source by name as it was then, so
    the history reads the same after a source is renamed."""
    return [
        {
            "funding": allocation.project_funding_id,
            "source": allocation.project_funding.source.name,
            "amount": allocation.amount,
        }
        for allocation in allocations
    ]


def _funding_snapshot(funding: ProjectFunding) -> dict[str, Any]:
    return {
        "source": funding.source.name,
        "planned_amount": funding.planned_amount,
        "received_amount": funding.received_amount,
    }


def _assert_not_settled(sources: Iterable[FundingSource]) -> None:
    """Refused when one of the sources is settled. The status is read again
    under a row lock: `update_source` settles a source under the same lock, so
    a write cannot slip in between this check and the settlement."""
    ids = {source.pk for source in sources}
    if not ids:
        return
    settled = sorted(
        FundingSource.objects.select_for_update()
        .filter(pk__in=ids, status=FundingStatus.SETTLED)
        .values_list("name", flat=True)
    )
    if settled:
        raise SourceSettled(params={"sources": settled})


def assert_settled_charges_unchanged(item: CostItem, fields: Iterable[str]) -> None:
    """A cost charged to a settled source keeps what that source's report
    printed of it: the amount, the category and plan line it was reported
    under, and the date that made it eligible. Correcting one of them means
    reopening the source first."""
    touched = sorted(set(fields) & SETTLED_COST_FIELDS)
    if not touched or item._state.adding:
        return
    charged = CostAllocation.objects.filter(cost_item=item).values("project_funding__source")
    settled = sorted(
        FundingSource.objects.select_for_update()
        .filter(pk__in=charged, status=FundingStatus.SETTLED)
        .values_list("name", flat=True)
    )
    if settled:
        raise SourceSettled(params={"sources": settled, "fields": touched})


def settled_charged_items() -> QuerySet[CostAllocation, Any]:
    """The ids of the costs charged to a settled source, as a subquery."""
    return CostAllocation.objects.filter(
        project_funding__source__status=FundingStatus.SETTLED,
    ).values("cost_item")


def _assert_charges_fit_kind(source: FundingSource, kind: str) -> None:
    """A source's kind decides what can be charged to it, so a new kind has
    to accept every cost already charged there: a grant carrying fees does
    not become volunteer work, where those fees would count a second time."""
    mismatched = sorted({
        str(allocation.cost_item_id)
        for allocation in CostAllocation.objects.filter(project_funding__source=source).select_related("cost_item")
        if not source_accepts(kind, valuation=is_valuation(allocation.cost_item.kind, allocation.cost_item.form))
    })
    if mismatched:
        raise SourceKindInUse(params={"sources": [source.name], "cost_items": mismatched})


def is_counted(item: CostItem) -> bool:
    """The row's `counted`, for one item being written: priced, and paid or
    still owed to someone entitled to it (`sources.counted_cost_q` in SQL)."""
    if item.cost_amount is None:
        return False
    if item.paid_on is not None or item.participation_id is None:
        return True
    seat = item.participation
    return seat is not None and not seat.is_deleted and seat.status != Participation.Status.DECLINED


def available_for_allocation(item: CostItem) -> Decimal:
    return allocatable_amount(
        item.kind, item.form, item.cost_amount, in_kind_value(item.in_kind_hours, item.in_kind_hourly_rate),
    )


def assert_allocations_fit(item: CostItem) -> None:
    """Called after a cost's amount or form changed: its split must still fit.

    A split larger than the cost, or on the wrong kind of source (a fee that
    became volunteer work while charged to a grant), is refused rather than
    trimmed: which source gives way is the manager's decision, not ours.
    """
    if item._state.adding:
        return
    # Locked with their sources, so a source's kind cannot change under the check.
    allocations = list(
        CostAllocation.objects.filter(cost_item=item).select_related("project_funding__source").select_for_update()
    )
    if not allocations:
        return
    valuation = is_valuation(item.kind, item.form)
    mismatched = sorted(
        allocation.project_funding.source.name for allocation in allocations
        if not source_accepts(allocation.project_funding.source.kind, valuation=valuation)
    )
    if mismatched:
        raise AllocationKindMismatch(params={"cost_item": str(item.pk), "sources": mismatched})
    allocated = sum((allocation.amount for allocation in allocations), ZERO)
    available = available_for_allocation(item)
    if allocated > available:
        raise AllocationExceedsAmount(params={
            "cost_item": str(item.pk), "allocated": str(allocated), "available": str(available),
        })


def assert_line_allocations_fit(line: BudgetLine) -> None:
    """Called after a plan line's amount changed: its split must still fit."""
    allocated = sum((allocation.amount for allocation in LineAllocation.objects.filter(budget_line=line)), ZERO)
    available = planned_amount(line.quantity, line.unit_cost)
    if allocated > available:
        raise AllocationExceedsAmount(params={
            "budget_line": str(line.pk), "allocated": str(allocated), "available": str(available),
        })


def release_cost_allocations(budget: ProjectBudget, item: CostItem, *, actor: User | None) -> None:
    """Takes a cost that is leaving the budget off every source, logged on the
    cost. Refused when one of them is settled: its report already counts it."""
    allocations = list(CostAllocation.objects.filter(cost_item=item).select_related("project_funding__source"))
    if not allocations:
        return
    _assert_not_settled(allocation.project_funding.source for allocation in allocations)
    before = _allocation_snapshot(allocations)
    for allocation in allocations:
        allocation.delete()
    audit.record(
        budget, actor=actor, subject=item, action=FinanceAction.ALLOCATION_CHANGED,
        before={"allocations": before}, after={"allocations": []},
    )


def release_line_allocations(budget: ProjectBudget, line: BudgetLine, *, actor: User | None) -> None:
    allocations = list(LineAllocation.objects.filter(budget_line=line).select_related("project_funding__source"))
    if not allocations:
        return
    _assert_not_settled(allocation.project_funding.source for allocation in allocations)
    before = _allocation_snapshot(allocations)
    for allocation in allocations:
        allocation.delete()
    audit.record(
        budget, actor=actor, subject=line, action=FinanceAction.ALLOCATION_CHANGED,
        before={"allocations": before}, after={"allocations": []},
    )


def _fundings_of(budget: ProjectBudget, ids: Iterable[Any]) -> dict[Any, ProjectFunding]:
    """The fundings a split names, locked with their sources: the kind and the
    status the checks read cannot change before the split is written."""
    wanted = set(ids)
    fundings = {
        funding.pk: funding
        for funding in ProjectFunding.objects.filter(budget=budget, pk__in=wanted)
        .select_related("source").select_for_update()
    }
    if set(fundings) != wanted:
        raise UnknownFunding()
    return fundings


def _replace_allocations(
    existing: list[Allocation],
    requested: dict[Any, Decimal],
    create: Any,
) -> bool:
    """Brings a split to ``requested`` (funding id → amount): changed amounts in
    place, dropped sources soft-deleted, new ones created. Answers whether
    anything changed."""
    changed = False
    by_funding = {allocation.project_funding_id: allocation for allocation in existing}
    for funding_id, allocation in by_funding.items():
        if funding_id not in requested:
            allocation.delete()
            changed = True
        elif allocation.amount != requested[funding_id]:
            allocation.amount = requested[funding_id]
            allocation.save(update_fields=["amount", "updated_at"])
            changed = True
    for funding_id, amount in requested.items():
        if funding_id not in by_funding:
            create(funding_id, amount)
            changed = True
    return changed


class FundingService:
    # ------------------------------------------------------------------ #
    # Sources — the organisation's, not a project's                        #
    # ------------------------------------------------------------------ #

    @staticmethod
    def create_source(dto: FundingSourceDTO, *, actor: User | None) -> FundingSource:
        if dto.eligible_from and dto.eligible_to and dto.eligible_from > dto.eligible_to:
            raise EligibilityPeriodInvalid()
        with transaction.atomic():
            source = FundingSource(
                kind=dto.kind,
                name=dto.name,
                grantor=dto.grantor,
                agreement_number=dto.agreement_number,
                agreement_date=dto.agreement_date,
                awarded_amount=None if dto.awarded_amount is None else money(dto.awarded_amount),
                status=dto.status,
                eligible_from=dto.eligible_from,
                eligible_to=dto.eligible_to,
                report_due_on=dto.report_due_on,
                required_own_share_pct=dto.required_own_share_pct,
                admin_cost_cap_pct=dto.admin_cost_cap_pct,
                line_tolerance_pct=dto.line_tolerance_pct,
                document_note_template=dto.document_note_template or DEFAULT_DOCUMENT_NOTE_TEMPLATE,
                note=dto.note,
            )
            source.save()
            audit.record(
                None, actor=actor, subject=source, action=FinanceAction.CREATED,
                after={"kind": source.kind, "name": source.name, "status": source.status},
            )
            return source

    @staticmethod
    def update_source(source: FundingSource, dto: FundingSourceUpdateDTO, *, actor: User | None) -> FundingSource:
        """Only the fields sent change. A settled source may change its status
        (reopening it) and its note; its figures stay as they were reported.
        Settling and correcting in one save is allowed, and so is reopening
        and correcting. A new kind must accept every cost already charged."""
        with transaction.atomic():
            source = FundingSource.objects.select_for_update().get(pk=source.pk)
            requested: dict[str, Any] = {}
            for name in dto.model_fields_set:
                value = getattr(dto, name)
                if name in _SOURCE_TEXT_FIELDS and value is None:
                    value = ""
                elif name == "awarded_amount" and value is not None:
                    value = money(value)
                requested[name] = value
            changed = {name: value for name, value in requested.items() if getattr(source, name) != value}
            if not changed:
                return source
            stays_settled = (
                source.status == FundingStatus.SETTLED
                and changed.get("status", source.status) == FundingStatus.SETTLED
            )
            figures = sorted(changed.keys() - _SETTLED_SOURCE_EDITABLE)
            if stays_settled and figures:
                raise SourceSettled(params={"sources": [source.name], "fields": figures})
            if "kind" in changed:
                _assert_charges_fit_kind(source, changed["kind"])
            eligible_from = changed.get("eligible_from", source.eligible_from)
            eligible_to = changed.get("eligible_to", source.eligible_to)
            if eligible_from and eligible_to and eligible_from > eligible_to:
                raise EligibilityPeriodInvalid()
            before = {name: getattr(source, name) for name in changed}
            for name, value in changed.items():
                setattr(source, name, value)
            source.save()
            audit.record(None, actor=actor, subject=source, action=FinanceAction.DETAILS_CHANGED,
                         before=before, after=changed)
            return source

    @staticmethod
    def delete_source(source: FundingSource, *, actor: User | None) -> None:
        """A source nobody counts on any more leaves the list. One that is on a
        project stays until every project lets it go."""
        with transaction.atomic():
            source = FundingSource.objects.select_for_update().get(pk=source.pk)
            projects = ProjectFunding.objects.filter(source=source).count()
            if projects:
                raise SourceInUse(params={"projects": projects})
            before = {name: getattr(source, name) for name in ("kind", "name", "status", "awarded_amount")}
            source.delete()
            audit.record(None, actor=actor, subject=source, action=FinanceAction.REMOVED, before=before)

    # ------------------------------------------------------------------ #
    # A project's fundings                                                 #
    # ------------------------------------------------------------------ #

    @staticmethod
    def add_funding(project: Project, dto: ProjectFundingDTO, *, actor: User | None) -> ProjectFunding:
        """Puts a source on the project. The planned amount is the plan's, so a
        source that arrives after approval comes with nothing planned — only
        with what it brought."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)
            planned = money(dto.planned_amount)
            if planned > 0:
                BudgetService.assert_plan_editable(budget)
            source = FundingSource.objects.select_for_update().filter(pk=dto.source).first()
            if source is None:
                raise UnknownSource()
            _assert_not_settled([source])
            if ProjectFunding.objects.filter(budget=budget, source=source).exists():
                raise FundingExists()
            funding = ProjectFunding.objects.create(
                budget=budget, source=source, planned_amount=planned, received_amount=money(dto.received_amount),
            )
            audit.record(budget, actor=actor, subject=funding, action=FinanceAction.CREATED,
                         after=_funding_snapshot(funding))
            return funding

    @staticmethod
    def update_funding(funding: ProjectFunding, dto: ProjectFundingUpdateDTO, *, actor: User | None) -> ProjectFunding:
        with transaction.atomic():
            budget = BudgetService.lock(funding.budget.project)
            BudgetService.assert_writable(budget)
            funding = ProjectFunding.objects.select_related("source").select_for_update().get(pk=funding.pk)
            requested = {name: money(getattr(dto, name)) for name in dto.model_fields_set}
            changed = {name: value for name, value in requested.items() if getattr(funding, name) != value}
            if not changed:
                return funding
            _assert_not_settled([funding.source])
            if "planned_amount" in changed:
                BudgetService.assert_plan_editable(budget)
            before = {name: getattr(funding, name) for name in changed}
            for name, value in changed.items():
                setattr(funding, name, value)
            funding.save(update_fields=[*changed, "updated_at"])
            audit.record(budget, actor=actor, subject=funding, action=FinanceAction.DETAILS_CHANGED,
                         before={"source": funding.source.name, **before}, after=changed)
            return funding

    @staticmethod
    def remove_funding(funding: ProjectFunding, *, actor: User | None) -> None:
        """Takes the source off the project, with its share of the plan. Costs
        charged to it keep it: they are the settlement's record, and taking
        them off it is a decision for each of them first."""
        with transaction.atomic():
            budget = BudgetService.lock(funding.budget.project)
            BudgetService.assert_writable(budget)
            funding = ProjectFunding.objects.select_related("source").select_for_update().get(pk=funding.pk)
            _assert_not_settled([funding.source])
            charged = CostAllocation.objects.filter(project_funding=funding).count()
            if charged:
                raise FundingInUse(params={"costs": charged})
            line_allocations = list(LineAllocation.objects.filter(project_funding=funding).select_related("budget_line"))
            if funding.planned_amount > 0 or line_allocations:
                BudgetService.assert_plan_editable(budget)
            for allocation in line_allocations:
                before_line = _allocation_snapshot(
                    LineAllocation.objects.filter(budget_line=allocation.budget_line)
                    .select_related("project_funding__source")
                )
                allocation.delete()
                audit.record(
                    budget, actor=actor, subject=allocation.budget_line, action=FinanceAction.ALLOCATION_CHANGED,
                    before={"allocations": before_line},
                    after={"allocations": _allocation_snapshot(
                        LineAllocation.objects.filter(budget_line=allocation.budget_line)
                        .select_related("project_funding__source")
                    )},
                )
            before = _funding_snapshot(funding)
            funding.delete()
            audit.record(budget, actor=actor, subject=funding, action=FinanceAction.REMOVED, before=before)

    # ------------------------------------------------------------------ #
    # The splits                                                           #
    # ------------------------------------------------------------------ #

    @staticmethod
    def set_line_allocations(line: BudgetLine, dto: AllocationSetDTO, *, actor: User | None) -> None:
        """The plan's split of one line, replacing what it had. Part of the
        plan: it changes while the plan is being planned."""
        with transaction.atomic():
            budget = BudgetService.lock(line.budget.project)
            BudgetService.assert_plan_editable(budget)
            line = BudgetLine.objects.select_for_update().get(pk=line.pk)
            fundings = _fundings_of(budget, (entry.funding for entry in dto.allocations))
            requested = {entry.funding: money(entry.amount) for entry in dto.allocations}
            allocated = sum(requested.values(), ZERO)
            available = planned_amount(line.quantity, line.unit_cost)
            if allocated > available:
                raise AllocationExceedsAmount(params={
                    "budget_line": str(line.pk), "allocated": str(allocated), "available": str(available),
                })
            existing: list[Allocation] = list(
                LineAllocation.objects.filter(budget_line=line).select_related("project_funding__source")
            )
            _assert_split_not_settled(existing, requested, fundings)
            before = _allocation_snapshot(existing)

            def create(funding_id: Any, amount: Decimal) -> None:
                LineAllocation.objects.create(budget_line=line, project_funding=fundings[funding_id], amount=amount)

            if _replace_allocations(existing, requested, create):
                audit.record(
                    budget, actor=actor, subject=line, action=FinanceAction.ALLOCATION_CHANGED,
                    before={"allocations": before},
                    after={"allocations": _allocation_snapshot(
                        LineAllocation.objects.filter(budget_line=line).select_related("project_funding__source")
                    )},
                )

    @staticmethod
    def set_cost_allocations(item: CostItem, dto: AllocationSetDTO, *, actor: User | None) -> None:
        """The actual split of one cost, replacing what it had. An act on the
        actuals: open until the budget closes. A cost the budget does not count
        (a price not set yet, a fee whose singer declined) can only be taken
        off its sources, not charged to them."""
        with transaction.atomic():
            budget = BudgetService.lock(item.budget.project)
            BudgetService.assert_writable(budget)
            item = CostItem.objects.select_related("participation").get(pk=item.pk)
            fundings = _fundings_of(budget, (entry.funding for entry in dto.allocations))
            requested = {entry.funding: money(entry.amount) for entry in dto.allocations}
            existing: list[Allocation] = list(
                CostAllocation.objects.filter(cost_item=item).select_related("project_funding__source")
            )
            if requested:
                _check_chargeable(item, fundings.values())
                allocated = sum(requested.values(), ZERO)
                available = available_for_allocation(item)
                if allocated > available:
                    raise AllocationExceedsAmount(params={
                        "cost_item": str(item.pk), "allocated": str(allocated), "available": str(available),
                    })
            _assert_split_not_settled(existing, requested, fundings)
            before = _allocation_snapshot(existing)

            def create(funding_id: Any, amount: Decimal) -> None:
                CostAllocation.objects.create(cost_item=item, project_funding=fundings[funding_id], amount=amount)

            if _replace_allocations(existing, requested, create):
                audit.record(
                    budget, actor=actor, subject=item, action=FinanceAction.ALLOCATION_CHANGED,
                    before={"allocations": before},
                    after={"allocations": _allocation_snapshot(
                        CostAllocation.objects.filter(cost_item=item).select_related("project_funding__source")
                    )},
                )

    @staticmethod
    def charge_costs(funding: ProjectFunding, dto: ChargeCostsDTO, *, actor: User | None) -> int:
        """Charges what each cost has left uncovered to one funding — the one
        act for "the grant pays the singers". All or nothing: a cost that is
        not this budget's, not counted, or of the wrong kind for the source
        refuses the call and every such cost is named. A cost already covered
        in full is left as it is. Answers how many costs it charged."""
        with transaction.atomic():
            budget = BudgetService.lock(funding.budget.project)
            BudgetService.assert_writable(budget)
            # Locked with its source: the kind every cost is checked against
            # cannot change before the charges are written.
            funding = ProjectFunding.objects.select_related("source").select_for_update().get(pk=funding.pk)
            _assert_not_settled([funding.source])
            items = {
                item.pk: item
                for item in CostItem.objects.filter(budget=budget, pk__in=dto.ids).select_related("participation")
            }
            refused: list[dict[str, str]] = []
            for item_id in dto.ids:
                item = items.get(item_id)
                reason = ""
                if item is None:
                    reason = "unknown"
                elif not is_counted(item):
                    reason = "not_counted"
                elif not source_accepts(funding.source.kind, valuation=is_valuation(item.kind, item.form)):
                    reason = "kind_mismatch"
                if reason:
                    refused.append({"id": str(item_id), "reason": reason})
            if refused:
                raise ChargeRefused(params={"refused": refused})

            charged = 0
            for item_id in dto.ids:
                item = items[item_id]
                existing = list(CostAllocation.objects.filter(cost_item=item).select_related("project_funding__source"))
                remainder = available_for_allocation(item) - sum((a.amount for a in existing), ZERO)
                if remainder <= 0:
                    continue
                before = _allocation_snapshot(existing)
                current = next((a for a in existing if a.project_funding_id == funding.pk), None)
                if current is None:
                    CostAllocation.objects.create(cost_item=item, project_funding=funding, amount=remainder)
                else:
                    current.amount += remainder
                    current.save(update_fields=["amount", "updated_at"])
                audit.record(
                    budget, actor=actor, subject=item, action=FinanceAction.ALLOCATION_CHANGED,
                    before={"allocations": before},
                    after={"allocations": _allocation_snapshot(
                        CostAllocation.objects.filter(cost_item=item).select_related("project_funding__source")
                    )},
                )
                charged += 1
            return charged


def _check_chargeable(item: CostItem, fundings: Iterable[ProjectFunding]) -> None:
    if not is_counted(item):
        raise AllocationNotCounted(params={"cost_item": str(item.pk)})
    valuation = is_valuation(item.kind, item.form)
    mismatched = sorted(
        funding.source.name for funding in fundings if not source_accepts(funding.source.kind, valuation=valuation)
    )
    if mismatched:
        raise AllocationKindMismatch(params={"cost_item": str(item.pk), "sources": mismatched})


def _assert_split_not_settled(
    existing: list[Allocation], requested: dict[Any, Decimal], fundings: dict[Any, ProjectFunding],
) -> None:
    """A settled source's share of a split stays exactly as it was: it may be
    neither added, nor changed, nor taken away."""
    touched: list[FundingSource] = []
    current = {allocation.project_funding_id: allocation for allocation in existing}
    for funding_id, allocation in current.items():
        if requested.get(funding_id) != allocation.amount:
            touched.append(allocation.project_funding.source)
    for funding_id in requested.keys() - current.keys():
        touched.append(fundings[funding_id].source)
    _assert_not_settled(touched)
