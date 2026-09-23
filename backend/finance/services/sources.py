"""
@file sources.py
@description Funding sources as the foundation reads them across projects. A
             grant is settled per agreement, not per concert, so a source's
             figures sum every project it funds: what the projects expect of it,
             what has arrived, what the plan asks of it, what is charged to it,
             and how its rules measure up — the own share it requires, the cap on
             administration, the amount it awarded. Also the list of every cost
             charged to one source, which is what its settlement reports. Read
             only; the writes are `services/funding.py`.
@architecture Enterprise SaaS 2026
@module finance/services/sources
"""
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.db.models import Count, Q, Sum

from roster.models import Participation

from ..models import (
    BudgetLine,
    CostAllocation,
    CostCategory,
    CostItem,
    FundingKind,
    FundingSource,
    FundingStatus,
    LineAllocation,
    ProjectFunding,
)
from ..rules import (
    ZERO,
    PlanEntry,
    effective_awarded,
    is_eligible_on,
    money,
    plan_numbers,
    planned_amount,
    share_pct,
)


def counted_cost_q(prefix: str = "") -> Q:
    """The costs a budget counts, as a query over ``CostItem`` (or over a
    relation to it, through ``prefix``): live and priced, and either paid or
    still owed to someone entitled to it. It states in SQL what the ledger's
    `counted` states row by row in `services/budget.py::_row` — a declined or
    removed singer's unpaid fee is not counted, a paid one always is."""
    p = prefix
    return Q(**{
        f"{p}is_deleted": False,
        f"{p}cost_amount__isnull": False,
        f"{p}budget__project__is_deleted": False,
    }) & (
        Q(**{f"{p}paid_on__isnull": False})
        | Q(**{f"{p}participation__isnull": True})
        | (
            Q(**{f"{p}participation__is_deleted": False})
            & ~Q(**{f"{p}participation__status": Participation.Status.DECLINED})
        )
    )


@dataclass(frozen=True)
class FundingFigures:
    """One project's funding from one source, in the ledger's money."""

    charged: Decimal = ZERO
    charged_count: int = 0
    line_allocated: Decimal = ZERO


@dataclass(frozen=True)
class SourceFigures:
    """A source across every project it funds.

    `ceiling` is what the source may carry at most: what it awarded (nothing,
    once it refused), or while it has not decided, what the projects expect of
    it. The two own-share and administration percentages are measured on the
    plan and on the actuals; either one below or above the rule breaks it.
    """

    project_count: int
    planned: Decimal
    received: Decimal
    line_allocated: Decimal
    charged: Decimal
    ceiling: Decimal | None
    remaining: Decimal | None
    over_awarded: bool
    own_share_plan_pct: Decimal | None
    own_share_actual_pct: Decimal | None
    own_share_below: bool
    admin_plan_pct: Decimal | None
    admin_actual_pct: Decimal | None
    admin_cap_exceeded: bool


@dataclass(frozen=True)
class SourceView:
    source: FundingSource
    figures: SourceFigures


@dataclass
class Measures:
    sources: dict[UUID, SourceView] = field(default_factory=dict)
    fundings: dict[UUID, FundingFigures] = field(default_factory=dict)


@dataclass
class _Totals:
    charged: Decimal = ZERO
    charged_admin: Decimal = ZERO
    charged_count: int = 0
    line_allocated: Decimal = ZERO
    line_allocated_admin: Decimal = ZERO


@dataclass(frozen=True)
class _FundingRow:
    id: UUID
    source_id: UUID
    budget_id: UUID
    planned_amount: Decimal
    received_amount: Decimal


def measure(sources: Sequence[FundingSource]) -> Measures:
    """Every figure of ``sources`` and of each project funding they have, in a
    fixed number of queries however many sources and projects there are."""
    if not sources:
        return Measures()
    fundings = [
        _FundingRow(
            id=funding.pk, source_id=funding.source_id, budget_id=funding.budget_id,
            planned_amount=funding.planned_amount, received_amount=funding.received_amount,
        )
        for funding in ProjectFunding.objects.filter(source__in=sources, budget__project__is_deleted=False)
    ]
    funding_ids = [row.id for row in fundings]
    budget_ids = {row.budget_id for row in fundings}

    totals: dict[UUID, _Totals] = {funding_id: _Totals() for funding_id in funding_ids}
    charges = (
        CostAllocation.objects.filter(project_funding__in=funding_ids)
        .filter(counted_cost_q("cost_item__"))
        .values("project_funding_id", "cost_item__category")
        .annotate(total=Sum("amount"), count=Count("id"))
    )
    for charge in charges:
        entry = totals[charge["project_funding_id"]]
        entry.charged += charge["total"]
        entry.charged_count += charge["count"]
        if charge["cost_item__category"] == CostCategory.ADMINISTRATION:
            entry.charged_admin += charge["total"]
    plan_shares = (
        LineAllocation.objects.filter(project_funding__in=funding_ids, budget_line__is_deleted=False)
        .values("project_funding_id", "budget_line__category")
        .annotate(total=Sum("amount"))
    )
    for share in plan_shares:
        entry = totals[share["project_funding_id"]]
        entry.line_allocated += share["total"]
        if share["budget_line__category"] == CostCategory.ADMINISTRATION:
            entry.line_allocated_admin += share["total"]

    plan_totals, task_totals = _task_totals(budget_ids)

    measures = Measures(
        fundings={
            funding_id: FundingFigures(
                charged=money(entry.charged),
                charged_count=entry.charged_count,
                line_allocated=money(entry.line_allocated),
            )
            for funding_id, entry in totals.items()
        },
    )
    by_source: dict[UUID, list[_FundingRow]] = {}
    for row in fundings:
        by_source.setdefault(row.source_id, []).append(row)
    for source in sources:
        figures = _figures(source, by_source.get(source.pk, []), totals, plan_totals, task_totals)
        measures.sources[source.pk] = SourceView(source=source, figures=figures)
    return measures


def _task_totals(budget_ids: set[UUID]) -> tuple[dict[UUID, Decimal], dict[UUID, Decimal]]:
    """Per budget: the plan's total, and what the task actually cost — the
    counted costs plus what came in kind (volunteer work charged at its
    valuation, gifts in kind at what they were worth), because a grant's own
    share counts both."""
    plan_totals: dict[UUID, Decimal] = {}
    for line in BudgetLine.objects.filter(budget__in=budget_ids).values("budget_id", "quantity", "unit_cost"):
        plan_totals[line["budget_id"]] = (
            plan_totals.get(line["budget_id"], ZERO) + planned_amount(line["quantity"], line["unit_cost"])
        )
    task_totals: dict[UUID, Decimal] = {}
    committed = (
        CostItem.objects.filter(budget__in=budget_ids).filter(counted_cost_q())
        .values("budget_id").annotate(total=Sum("cost_amount"))
    )
    for row in committed:
        task_totals[row["budget_id"]] = task_totals.get(row["budget_id"], ZERO) + row["total"]
    volunteer_work = (
        CostAllocation.objects.filter(
            project_funding__budget__in=budget_ids,
            project_funding__is_deleted=False,
            project_funding__source__kind=FundingKind.VOLUNTEER_WORK,
        )
        .filter(counted_cost_q("cost_item__"))
        .values("project_funding__budget_id").annotate(total=Sum("amount"))
    )
    for row in volunteer_work:
        budget_id = row["project_funding__budget_id"]
        task_totals[budget_id] = task_totals.get(budget_id, ZERO) + row["total"]
    in_kind = (
        ProjectFunding.objects.filter(budget__in=budget_ids, source__kind=FundingKind.IN_KIND)
        .values("budget_id").annotate(total=Sum("received_amount"))
    )
    for row in in_kind:
        task_totals[row["budget_id"]] = task_totals.get(row["budget_id"], ZERO) + row["total"]
    return plan_totals, task_totals


def _figures(
    source: FundingSource,
    rows: list[_FundingRow],
    totals: dict[UUID, _Totals],
    plan_totals: dict[UUID, Decimal],
    task_totals: dict[UUID, Decimal],
) -> SourceFigures:
    planned = received = charged = charged_admin = line_allocated = line_allocated_admin = ZERO
    task_planned = task_total = ZERO
    # A source is on a budget at most once (a unique constraint), so each row
    # brings its project's totals exactly once.
    for row in rows:
        entry = totals[row.id]
        planned += row.planned_amount
        received += row.received_amount
        charged += entry.charged
        charged_admin += entry.charged_admin
        line_allocated += entry.line_allocated
        line_allocated_admin += entry.line_allocated_admin
        task_planned += plan_totals.get(row.budget_id, ZERO)
        task_total += task_totals.get(row.budget_id, ZERO)

    awarded = effective_awarded(source.status, source.awarded_amount)
    ceiling = awarded if awarded is not None else (planned if rows else None)
    over_awarded = awarded is not None and (planned > awarded or charged > awarded)

    own_plan = share_pct(task_planned - planned, task_planned)
    own_actual = share_pct(task_total - charged, task_total)
    required = source.required_own_share_pct
    own_share_below = required is not None and source.status != FundingStatus.REJECTED and (
        (own_plan is not None and planned > 0 and own_plan < required)
        or (own_actual is not None and charged > 0 and own_actual < required)
    )

    admin_plan = share_pct(line_allocated_admin, line_allocated)
    admin_actual = share_pct(charged_admin, charged)
    cap = source.admin_cost_cap_pct
    admin_cap_exceeded = cap is not None and (
        (admin_plan is not None and admin_plan > cap) or (admin_actual is not None and admin_actual > cap)
    )

    return SourceFigures(
        project_count=len(rows),
        planned=money(planned),
        received=money(received),
        line_allocated=money(line_allocated),
        charged=money(charged),
        ceiling=None if ceiling is None else money(ceiling),
        remaining=None if ceiling is None else money(ceiling - charged),
        over_awarded=over_awarded,
        own_share_plan_pct=own_plan,
        own_share_actual_pct=own_actual,
        own_share_below=own_share_below,
        admin_plan_pct=admin_plan,
        admin_actual_pct=admin_actual,
        admin_cap_exceeded=admin_cap_exceeded,
    )


# --------------------------------------------------------------------------- #
# One source's page                                                            #
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class SourceProjectView:
    """A project the source funds, with the project's funding figures."""

    funding_id: UUID
    project_id: UUID
    project_title: str
    project_date_time: datetime
    budget_status: str
    planned_amount: Decimal
    received_amount: Decimal
    line_allocated: Decimal
    charged: Decimal


@dataclass(frozen=True)
class SourceChargeView:
    """One cost charged to the source — a line of its settlement."""

    cost_item_id: UUID
    kind: str
    project_id: UUID
    project_title: str
    payee_name: str
    vendor_name: str
    description: str
    category: str
    plan_line: str
    document_number: str
    incurred_on: date
    paid_on: date | None
    cost_amount: Decimal
    amount: Decimal
    eligible: bool


@dataclass(frozen=True)
class SourceDetail:
    view: SourceView
    projects: list[SourceProjectView]
    charges: list[SourceChargeView]


def detail(source: FundingSource) -> SourceDetail:
    """The source with every project it funds and every cost charged to it,
    in the order a settlement lists them: by the date the cost arose."""
    measures = measure([source])
    fundings = list(
        ProjectFunding.objects.filter(source=source, budget__project__is_deleted=False)
        .select_related("budget__project")
        .order_by("budget__project__date_time")
    )
    projects = [
        SourceProjectView(
            funding_id=funding.pk,
            project_id=funding.budget.project_id,
            project_title=funding.budget.project.title,
            project_date_time=funding.budget.project.date_time,
            budget_status=funding.budget.status,
            planned_amount=funding.planned_amount,
            received_amount=funding.received_amount,
            line_allocated=measures.fundings[funding.pk].line_allocated,
            charged=measures.fundings[funding.pk].charged,
        )
        for funding in fundings
    ]
    allocations = list(
        CostAllocation.objects.filter(project_funding__in=[funding.pk for funding in fundings])
        .filter(counted_cost_q("cost_item__"))
        .select_related("cost_item__budget__project")
        .order_by("cost_item__incurred_on", "cost_item__created_at")
    )
    numbers = _line_numbers({allocation.cost_item.budget_id for allocation in allocations})
    charges = [_charge(source, allocation, numbers) for allocation in allocations]
    return SourceDetail(view=measures.sources[source.pk], projects=projects, charges=charges)


def _charge(source: FundingSource, allocation: CostAllocation, numbers: dict[UUID, str]) -> SourceChargeView:
    item = allocation.cost_item
    return SourceChargeView(
        cost_item_id=item.pk,
        kind=item.kind,
        project_id=item.budget.project_id,
        project_title=item.budget.project.title,
        payee_name=item.payee_name,
        vendor_name=item.vendor_name,
        description=item.description,
        category=item.category,
        plan_line=numbers.get(item.budget_line_id, "") if item.budget_line_id else "",
        document_number=item.document_number,
        incurred_on=item.incurred_on,
        paid_on=item.paid_on,
        cost_amount=item.cost_amount or ZERO,
        amount=allocation.amount,
        eligible=is_eligible_on(item.incurred_on, source.eligible_from, source.eligible_to),
    )


def _line_numbers(budget_ids: set[UUID]) -> dict[UUID, str]:
    """Each line's kosztorys number with its name — "I.2 Wynajem kościoła" —
    numbered within its own budget."""
    lines: dict[UUID, list[BudgetLine]] = {}
    for line in BudgetLine.objects.filter(budget__in=budget_ids):
        lines.setdefault(line.budget_id, []).append(line)
    labels: dict[UUID, str] = {}
    for budget_lines in lines.values():
        entries = [
            PlanEntry(key=line.pk, category=line.category, position=line.position, created_at=line.created_at)
            for line in budget_lines
        ]
        numbers = plan_numbers(entries)
        for line in budget_lines:
            labels[line.pk] = f"{numbers[line.pk]} {line.name}"
    return labels


def all_sources() -> list[FundingSource]:
    """Every live source, the undecided and running ones first, then by name."""
    order: dict[str, int] = {
        FundingStatus.AWARDED: 0,
        FundingStatus.APPLIED: 1,
        FundingStatus.PLANNED: 2,
        FundingStatus.SETTLED: 3,
        FundingStatus.REJECTED: 4,
    }
    return sorted(FundingSource.objects.all(), key=lambda source: (order.get(source.status, 9), source.name.casefold()))
