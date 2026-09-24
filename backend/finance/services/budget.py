"""
@file budget.py
@description The read side of a project's money: the fee ledger rows (including
             the unpriced rows computed from the roster at read time), the
             expenses, the plan lines with what has been charged to each, the
             funding sources the project counts on and how each line and cost
             is split between them, the summary and the coverage summed in
             Decimal, and the warnings. The client renders all of it and
             computes none of it — so the hub tab, the global page and the
             project card cannot disagree about what a number means.
@architecture Enterprise SaaS 2026
@module finance/services/budget
"""
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import models
from django.db.models import Min
from django.utils import timezone

from roster.models import CrewAssignment, Participation, Project, Rehearsal

from ..exceptions import BudgetLocked, PlanLineCategoryMismatch, PlanLocked, UnknownPlanLine
from ..models import (
    NON_CASH_FUNDING_KINDS,
    BudgetLine,
    BudgetStatus,
    Contract,
    ContractStatus,
    CostAllocation,
    CostItem,
    CostKind,
    FeeForm,
    FinanceAttachment,
    FundingKind,
    FundingSource,
    LineAllocation,
    ProjectBudget,
    ProjectFunding,
)
from ..rules import (
    DOCUMENT_DUE_WINDOW_DAYS,
    FINANCE_TIMEZONE,
    PAYABLE_CONTRACT_FORMS,
    PAYABLE_DUE_SOON_DAYS,
    VOLUNTEER_INSURANCE_MAX_DAYS,
    ZERO,
    PlanEntry,
    allocatable_amount,
    category_for,
    charge_limit,
    default_form_for,
    exceeds_tolerance,
    in_kind_value,
    is_eligible_on,
    line_tolerance_pct,
    local_date,
    minimum_hourly_rate,
    money,
    payee_snapshot,
    plan_numbers,
    plan_order,
    plan_section,
    planned_amount,
    report_due_soon,
)
from .sources import FundingFigures, Measures, SourceView, measure

ORIGIN_CAST = "cast"
ORIGIN_CREW = "crew"
ORIGIN_ONE_OFF = "one_off"

SEVERITY_WORK = "work"
SEVERITY_PROBLEM = "problem"


@dataclass(frozen=True)
class AllocationView:
    """One source's share of a plan line or of a cost."""

    funding_id: UUID
    amount: Decimal


def _allocated(allocations: list[AllocationView]) -> Decimal:
    return money(sum((allocation.amount for allocation in allocations), ZERO))


@dataclass(frozen=True)
class ContractView:
    id: UUID
    number: str
    form: str
    amount: Decimal
    status: str
    issued_at: datetime
    signed_on: date | None
    signed_copy_location: str
    hours_confirmed: Decimal | None


@dataclass(frozen=True)
class LedgerRow:
    """One person the project owes (or may owe) a fee.

    `key` is the id the client sends back as the row's `ref`: the cast seat's,
    the crew assignment's, or — for a one-off payee, who has no roster record —
    the cost item's. Warnings name rows by the same key.
    """

    key: UUID
    origin: str
    participation_id: UUID | None
    crew_assignment_id: UUID | None
    cost_item_id: UUID | None
    payee_name: str
    payee_role: str
    seat_status: str | None
    is_declined: bool
    billable: bool
    orphaned: bool
    counted: bool
    category: str
    budget_line_id: UUID | None
    form: str
    default_form: str | None
    contract_amount: Decimal | None
    employer_contributions: Decimal | None
    cost_amount: Decimal | None
    in_kind_hours: Decimal | None
    in_kind_hourly_rate: Decimal | None
    in_kind_value: Decimal | None
    incurred_on: date
    due_on: date | None
    paid_on: date | None
    paid_marked_at: datetime | None
    document_number: str
    document_date: date | None
    vendor_nip: str
    note: str
    contract: ContractView | None
    # The sources the fee is charged to, and what can be split between them:
    # its cost, or a volunteer's valuation.
    allocations: list[AllocationView] = field(default_factory=list)
    allocatable: Decimal = ZERO
    # Paid on paper before the ledger existed: no contract of the ledger's is due.
    paid_before_ledger: bool = False

    @property
    def is_priced(self) -> bool:
        return self.cost_item_id is not None and self.contract_amount is not None

    @property
    def is_paid(self) -> bool:
        return self.paid_on is not None

    @property
    def allocated(self) -> Decimal:
        return _allocated(self.allocations)

    @property
    def unallocated(self) -> Decimal:
        """What no source covers yet — the foundation's own until charged."""
        return money(self.allocatable - self.allocated)


@dataclass(frozen=True)
class AttachmentView:
    id: UUID
    original_name: str
    mime_type: str
    size_bytes: int
    uploaded_at: datetime


@dataclass(frozen=True)
class ExpenseRow:
    """One cost that is not a person's fee. Always counted: an expense exists
    because a document says the foundation owes it."""

    id: UUID
    category: str
    budget_line_id: UUID | None
    vendor_name: str
    vendor_nip: str
    document_type: str
    document_number: str
    document_date: date | None
    description: str
    cost_amount: Decimal
    incurred_on: date
    due_on: date | None
    paid_on: date | None
    paid_marked_at: datetime | None
    note: str
    attachments: list[AttachmentView]
    allocations: list[AllocationView] = field(default_factory=list)

    @property
    def is_paid(self) -> bool:
        return self.paid_on is not None

    @property
    def allocated(self) -> Decimal:
        return _allocated(self.allocations)

    @property
    def unallocated(self) -> Decimal:
        return money(self.cost_amount - self.allocated)


@dataclass(frozen=True)
class PlanLineView:
    """A plan line with what has actually been charged to it.

    `actual` sums the counted costs on the line — the same costs the headline
    counts — so the plan and the ledger read the same money. `allocations` is
    the plan's split between sources; `tolerance_pct` the overrun the line's
    sources allow without an annex, and `over_tolerance` whether it is past it.
    """

    id: UUID
    number: str
    section: str
    category: str
    name: str
    position: int
    unit: str
    quantity: Decimal
    unit_cost: Decimal
    planned_amount: Decimal
    note: str
    actual: Decimal
    paid: Decimal
    cost_count: int
    allocations: list[AllocationView]
    tolerance_pct: Decimal
    over_tolerance: bool

    @property
    def over_plan(self) -> bool:
        return self.actual > self.planned_amount

    @property
    def allocated(self) -> Decimal:
        return _allocated(self.allocations)

    @property
    def unallocated(self) -> Decimal:
        return money(self.planned_amount - self.allocated)


@dataclass(frozen=True)
class FundingView:
    """A source on this project: what the project expects of it, what arrived,
    what the plan asks of it and what is charged to it — with the source's own
    figures across every project it funds.

    A source of money may carry the project's costs up to what the project
    expects of it or what has arrived, whichever is more. The foundation's own
    funds have no such limit — nobody awards them, they are whatever the
    foundation spends — and volunteer work and gifts in kind carry no costs.
    """

    id: UUID
    source: SourceView
    planned_amount: Decimal
    received_amount: Decimal
    line_allocated: Decimal
    charged: Decimal
    charged_count: int

    @property
    def brings_money(self) -> bool:
        return self.source.source.kind not in NON_CASH_FUNDING_KINDS

    @property
    def charge_limit(self) -> Decimal:
        return charge_limit(self.planned_amount, self.received_amount)

    @property
    def over_plan_allocation(self) -> bool:
        return self.line_allocated > self.planned_amount

    @property
    def over_charge_limit(self) -> bool:
        if not self.brings_money or self.source.source.kind == FundingKind.OWN_FUNDS:
            return False
        return self.charged > self.charge_limit

    @property
    def overallocated(self) -> bool:
        return self.over_plan_allocation or self.over_charge_limit or self.source.figures.over_awarded


@dataclass(frozen=True)
class FundingSummary:
    """How the project is covered. Money sources and contributions in kind are
    kept apart: only money pays a cost. `uncovered` is the counted cost no
    source of money carries — the foundation's own, or not yet funded;
    `plan_uncovered` the same on the plan (negative when the sources are
    expected to bring more than the plan costs), None without a plan."""

    planned: Decimal
    received: Decimal
    charged: Decimal
    uncovered: Decimal
    in_kind_planned: Decimal
    in_kind_contributed: Decimal
    plan_uncovered: Decimal | None


@dataclass(frozen=True)
class CategoryTotal:
    category: str
    committed: Decimal
    paid: Decimal


@dataclass(frozen=True)
class Totals:
    committed: Decimal
    paid: Decimal
    outstanding: Decimal


@dataclass(frozen=True)
class Summary:
    """The project's money. `committed`, `paid` and `outstanding` are the whole
    budget — fees and expenses; `fees` and `expenses` split them. `planned` is
    the plan's total, or None while the budget has no plan lines; `unplanned`
    is the counted cost charged to no line."""

    committed: Decimal
    paid: Decimal
    outstanding: Decimal
    in_kind: Decimal
    fees: Totals
    expenses: Totals
    planned: Decimal | None
    unplanned: Decimal
    by_category: list[CategoryTotal]
    rows: int
    priced: int
    unpriced: int
    paid_count: int
    orphaned: int
    volunteers: int
    expense_count: int
    lines: int


@dataclass(frozen=True)
class BudgetWarning:
    code: str
    severity: str
    subject_ids: list[UUID]
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProjectMoney:
    project: Project
    budget: ProjectBudget | None
    rows: list[LedgerRow]
    expenses: list[ExpenseRow]
    lines: list[PlanLineView]
    fundings: list[FundingView]
    summary: Summary
    funding: FundingSummary
    warnings: list[BudgetWarning]

    @property
    def budget_status(self) -> str:
        return self.budget.status if self.budget is not None else BudgetStatus.PLANNING


@dataclass
class _ProjectSources:
    """Everything one project's money is computed from, loaded in bulk."""

    items: list[CostItem] = field(default_factory=list)
    expenses: list[CostItem] = field(default_factory=list)
    lines: list[BudgetLine] = field(default_factory=list)
    attachments: dict[UUID, list[FinanceAttachment]] = field(default_factory=dict)
    fundings: list[ProjectFunding] = field(default_factory=list)
    cost_allocations: dict[UUID, list[AllocationView]] = field(default_factory=dict)
    line_allocations: dict[UUID, list[AllocationView]] = field(default_factory=dict)
    seats: list[Participation] = field(default_factory=list)
    crew: list[CrewAssignment] = field(default_factory=list)
    first_rehearsal: datetime | None = None


class BudgetService:
    @staticmethod
    def get_or_create(project: Project) -> ProjectBudget:
        """The project's budget, created on first use. `all_objects`, because the
        one-to-one is unique whatever `is_deleted` says."""
        budget, _ = ProjectBudget.all_objects.get_or_create(project=project)
        return budget

    @staticmethod
    def lock(project: Project) -> ProjectBudget:
        """The budget row, locked for the rest of the caller's transaction.

        Every ledger write takes this lock first, so two batches on one project
        run one after the other instead of interleaving their rows.
        """
        budget = BudgetService.get_or_create(project)
        return ProjectBudget.all_objects.select_for_update().get(pk=budget.pk)

    @staticmethod
    def assert_writable(budget: ProjectBudget) -> None:
        if budget.status == BudgetStatus.CLOSED:
            raise BudgetLocked()

    @staticmethod
    def assert_plan_editable(budget: ProjectBudget) -> None:
        """The plan changes while it is being planned. An approved plan is a
        fact the board agreed to; correcting it means the board reopening it,
        with a reason, which the history keeps."""
        BudgetService.assert_writable(budget)
        if budget.status != BudgetStatus.PLANNING:
            raise PlanLocked()

    @staticmethod
    def resolve_line(budget: ProjectBudget, line_id: UUID | None, category: str) -> BudgetLine | None:
        """The plan line a cost is to be charged to, checked: it belongs to this
        budget and to the cost's own category, so the plan's lines and its
        category totals read the same money."""
        if line_id is None:
            return None
        line = BudgetLine.objects.filter(budget=budget, pk=line_id).first()
        if line is None:
            raise UnknownPlanLine()
        if line.category != category:
            raise PlanLineCategoryMismatch(params={"line_category": line.category, "category": category})
        return line

    @staticmethod
    def default_line(budget: ProjectBudget, category: str) -> BudgetLine | None:
        """The line a newly priced fee is charged to: the plan's only line of
        its category, when there is exactly one. With two ("Honoraria
        chórzystów", "Honorarium dyrygenta") the choice is the manager's, and
        the fee waits outside the plan until it is made."""
        lines = list(BudgetLine.objects.filter(budget=budget, category=category)[:2])
        return lines[0] if len(lines) == 1 else None

    @staticmethod
    def build(project: Project, *, now: datetime | None = None) -> ProjectMoney:
        return BudgetService.build_many([project], now=now)[0]

    @staticmethod
    def build_many(projects: Sequence[Project], *, now: datetime | None = None) -> list[ProjectMoney]:
        """Each project's money in a fixed number of queries, however many
        projects there are — the portfolio view asks for all of them."""
        moment = now or timezone.now()
        today = timezone.localdate(moment, timezone=FINANCE_TIMEZONE)
        sources = _load_sources(projects)
        budgets = {
            budget.project_id: budget
            for budget in ProjectBudget.all_objects.filter(project__in=[project.pk for project in projects])
        }
        contracts = _live_contracts(item for source in sources.values() for item in source.items)
        # A source's own figures sum every project it funds, not only these.
        funding_sources = {
            funding.source_id: funding.source
            for project_sources in sources.values()
            for funding in project_sources.fundings
        }
        measures = measure(list(funding_sources.values()))
        results: list[ProjectMoney] = []
        for project in projects:
            project_sources = sources.get(project.pk, _ProjectSources())
            rows = _rows(project, project_sources, contracts)
            expenses = _expense_rows(project_sources)
            fundings = _funding_views(project_sources.fundings, measures)
            lines = _plan_lines(project_sources, rows, expenses)
            summary = _summary(rows, expenses, lines)
            results.append(
                ProjectMoney(
                    project=project,
                    budget=budgets.get(project.pk),
                    rows=rows,
                    expenses=expenses,
                    lines=lines,
                    fundings=fundings,
                    summary=summary,
                    funding=_funding_summary(summary, fundings),
                    warnings=_warnings(
                        project, project_sources, rows, expenses, lines, fundings, moment, today,
                    ),
                )
            )
        return results

    @staticmethod
    def payables() -> models.QuerySet[CostItem]:
        """What the foundation still owes, across every project: fees priced
        above zero and every expense, unpaid and still counted (a paid-out
        orphan is not a payable, and an unpaid one is work on its project, not
        a debt)."""
        return (
            _money_costs()
            .filter(paid_on__isnull=True)
            .filter(
                models.Q(participation__isnull=True)
                | (
                    models.Q(participation__is_deleted=False)
                    & ~models.Q(participation__status=Participation.Status.DECLINED)
                )
            )
            .order_by(models.F('due_on').asc(nulls_last=True), 'incurred_on', 'payee_name', 'vendor_name')
        )

    @staticmethod
    def paid_costs() -> models.QuerySet[CostItem]:
        """What the foundation has paid, across every project, newest payment
        first. A paid cost stays counted whatever became of its seat, so no
        seat filter applies here."""
        return _money_costs().filter(paid_on__isnull=False).order_by('-paid_on', 'payee_name', 'vendor_name')

    @staticmethod
    def payables_summary(today: date) -> dict[str, Any]:
        """The payables' headline figures, summed by the database: everything
        owed, what is past its due date, and what falls due within
        ``PAYABLE_DUE_SOON_DAYS`` from ``today`` (today included, as it is not
        yet overdue). A payable with no due date is in the total only."""
        overdue = models.Q(due_on__lt=today)
        due_soon = models.Q(due_on__gte=today, due_on__lte=today + timedelta(days=PAYABLE_DUE_SOON_DAYS))
        figures = BudgetService.payables().order_by().aggregate(
            count=models.Count('pk'),
            total=models.Sum('cost_amount'),
            overdue_count=models.Count('pk', filter=overdue),
            overdue_total=models.Sum('cost_amount', filter=overdue),
            due_soon_count=models.Count('pk', filter=due_soon),
            due_soon_total=models.Sum('cost_amount', filter=due_soon),
        )
        return {
            'count': figures['count'],
            'total': money(figures['total'] or ZERO),
            'overdue_count': figures['overdue_count'],
            'overdue_total': money(figures['overdue_total'] or ZERO),
            'due_soon_count': figures['due_soon_count'],
            'due_soon_total': money(figures['due_soon_total'] or ZERO),
        }


def _money_costs() -> models.QuerySet[CostItem]:
    """The costs that are money, on a live project: fees priced above zero and
    every expense. A volunteer's fee is valued, never paid."""
    return CostItem.objects.filter(
        models.Q(kind=CostKind.FEE, contract_amount__gt=0) | models.Q(kind=CostKind.EXPENSE),
        budget__project__is_deleted=False,
    ).select_related('budget__project')


def reconcile_line_change(budget: ProjectBudget, item: CostItem, changed: dict[str, Any]) -> None:
    """Checks the line a cost ends up charged to after an edit (``changed``
    uses the model's attribute names). A cost moving to another category leaves
    a line of its old category unless the edit names a new line itself — the
    old line no longer describes it — and the removal lands in ``changed``, so
    the event records it."""
    category = changed.get("category", item.category)
    if (
        "category" in changed
        and "budget_line_id" not in changed
        and item.budget_line_id is not None
        and not BudgetLine.objects.filter(pk=item.budget_line_id, category=category).exists()
    ):
        changed["budget_line_id"] = None
    BudgetService.resolve_line(budget, changed.get("budget_line_id", item.budget_line_id), category)


def _load_sources(projects: Sequence[Project]) -> dict[UUID, _ProjectSources]:
    ids = [project.pk for project in projects]
    sources: dict[UUID, _ProjectSources] = {pk: _ProjectSources() for pk in ids}
    items = (
        CostItem.objects.filter(budget__project__in=ids)
        .select_related('budget', 'participation__artist', 'crew_assignment__collaborator')
        .order_by('created_at')
    )
    expense_ids: list[UUID] = []
    item_projects: dict[UUID, UUID] = {}
    for item in items:
        project_sources = sources[item.budget.project_id]
        item_projects[item.pk] = item.budget.project_id
        if item.kind == CostKind.EXPENSE:
            project_sources.expenses.append(item)
            expense_ids.append(item.pk)
        else:
            project_sources.items.append(item)
    line_projects: dict[UUID, UUID] = {}
    for line in BudgetLine.objects.filter(budget__project__in=ids).select_related('budget'):
        sources[line.budget.project_id].lines.append(line)
        line_projects[line.pk] = line.budget.project_id
    fundings = (
        ProjectFunding.objects.filter(budget__project__in=ids)
        .select_related('budget', 'source')
        .order_by('created_at')
    )
    for funding in fundings:
        sources[funding.budget.project_id].fundings.append(funding)
    if item_projects:
        cost_allocations = (
            CostAllocation.objects.filter(cost_item__in=list(item_projects), project_funding__is_deleted=False)
            .order_by('created_at')
        )
        for allocation in cost_allocations:
            project_sources = sources[item_projects[allocation.cost_item_id]]
            project_sources.cost_allocations.setdefault(allocation.cost_item_id, []).append(
                AllocationView(funding_id=allocation.project_funding_id, amount=allocation.amount)
            )
    if line_projects:
        line_allocations = (
            LineAllocation.objects.filter(budget_line__in=list(line_projects), project_funding__is_deleted=False)
            .order_by('created_at')
        )
        for line_allocation in line_allocations:
            project_sources = sources[line_projects[line_allocation.budget_line_id]]
            project_sources.line_allocations.setdefault(line_allocation.budget_line_id, []).append(
                AllocationView(funding_id=line_allocation.project_funding_id, amount=line_allocation.amount)
            )
    if expense_ids:
        attachments = FinanceAttachment.objects.filter(cost_item__in=expense_ids).select_related('cost_item__budget')
        for attachment in attachments:
            project_sources = sources[attachment.cost_item.budget.project_id]
            project_sources.attachments.setdefault(attachment.cost_item_id, []).append(attachment)
    # Active seats only; a soft-deleted seat reaches the ledger through its item.
    for seat in Participation.objects.filter(project__in=ids).select_related('artist'):
        sources[seat.project_id].seats.append(seat)
    for assignment in CrewAssignment.objects.filter(project__in=ids).select_related('collaborator'):
        sources[assignment.project_id].crew.append(assignment)
    firsts = (
        Rehearsal.objects.filter(project__in=ids)
        .values('project_id')
        .annotate(first=Min('date_time'))
    )
    for entry in firsts:
        sources[entry['project_id']].first_rehearsal = entry['first']
    return sources


def _live_contracts(items: Iterable[CostItem]) -> dict[UUID, Contract]:
    ids = [item.pk for item in items]
    if not ids:
        return {}
    live = Contract.objects.filter(cost_item__in=ids).exclude(status=ContractStatus.ANNULLED)
    return {contract.cost_item_id: contract for contract in live}


def _contract_view(contract: Contract | None) -> ContractView | None:
    if contract is None:
        return None
    return ContractView(
        id=contract.pk,
        number=contract.number,
        form=contract.form,
        amount=contract.amount,
        status=contract.status,
        issued_at=contract.issued_at,
        signed_on=contract.signed_on,
        signed_copy_location=contract.signed_copy_location,
        hours_confirmed=contract.hours_confirmed,
    )


def _person_sort_key(name: str) -> tuple[str, str]:
    parts = name.split()
    return (parts[-1].casefold() if parts else "", name.casefold())


def _row(
    *,
    key: UUID,
    origin: str,
    item: CostItem | None,
    contract: Contract | None,
    participation: Participation | None,
    crew_assignment: CrewAssignment | None,
    billable: bool,
    concert_day: date,
    allocations: dict[UUID, list[AllocationView]],
) -> LedgerRow:
    roster_source = participation or crew_assignment
    default_form = default_form_for(roster_source) if roster_source is not None else None
    # The name on a frozen contract is the name the paper carries. Otherwise the
    # roster is the source, read fresh, so a corrected surname shows at once.
    if roster_source is not None and contract is None:
        payee_name, payee_role = payee_snapshot(roster_source)
    elif item is not None:
        payee_name, payee_role = item.payee_name, item.payee_role
    else:
        payee_name, payee_role = "", ""

    seat_status: str | None = None
    is_declined = False
    if participation is not None:
        seat_status = participation.status
        is_declined = participation.status == Participation.Status.DECLINED
    elif crew_assignment is not None:
        seat_status = crew_assignment.status

    paid = item is not None and item.paid_on is not None
    priced = item is not None and item.contract_amount is not None
    orphaned = item is not None and not billable and not paid

    if item is None:
        return LedgerRow(
            key=key, origin=origin,
            participation_id=participation.pk if participation else None,
            crew_assignment_id=crew_assignment.pk if crew_assignment else None,
            cost_item_id=None,
            payee_name=payee_name, payee_role=payee_role,
            seat_status=seat_status, is_declined=is_declined,
            billable=billable, orphaned=False, counted=False,
            category=category_for(roster_source) if roster_source is not None else "",
            budget_line_id=None,
            form=default_form or "", default_form=default_form,
            contract_amount=None, employer_contributions=None, cost_amount=None,
            in_kind_hours=None, in_kind_hourly_rate=None, in_kind_value=None,
            incurred_on=concert_day, due_on=None, paid_on=None, paid_marked_at=None,
            document_number="", document_date=None, vendor_nip="", note="",
            contract=None,
        )

    valuation = in_kind_value(item.in_kind_hours, item.in_kind_hourly_rate)
    return LedgerRow(
        key=key, origin=origin,
        participation_id=item.participation_id,
        crew_assignment_id=item.crew_assignment_id,
        cost_item_id=item.pk,
        payee_name=payee_name, payee_role=payee_role,
        seat_status=seat_status, is_declined=is_declined,
        billable=billable, orphaned=orphaned,
        counted=priced and (billable or paid),
        category=item.category,
        budget_line_id=item.budget_line_id,
        form=item.form, default_form=default_form,
        contract_amount=item.contract_amount,
        employer_contributions=item.employer_contributions,
        cost_amount=item.cost_amount,
        in_kind_hours=item.in_kind_hours,
        in_kind_hourly_rate=item.in_kind_hourly_rate,
        in_kind_value=valuation,
        incurred_on=item.incurred_on,
        due_on=item.due_on,
        paid_on=item.paid_on,
        paid_marked_at=item.paid_marked_at,
        document_number=item.document_number,
        document_date=item.document_date,
        vendor_nip=item.vendor_nip,
        note=item.note,
        contract=_contract_view(contract),
        allocations=allocations.get(item.pk, []),
        allocatable=allocatable_amount(item.kind, item.form, item.cost_amount, valuation),
        paid_before_ledger=item.paid_before_ledger,
    )


def _rows(project: Project, sources: _ProjectSources, contracts: dict[UUID, Contract]) -> list[LedgerRow]:
    concert_day = local_date(project.date_time, project.timezone)
    by_seat = {item.participation_id: item for item in sources.items if item.participation_id is not None}
    by_crew = {item.crew_assignment_id: item for item in sources.items if item.crew_assignment_id is not None}

    cast_rows: list[LedgerRow] = []
    listed_seats: set[UUID] = set()
    for seat in sources.seats:
        item = by_seat.get(seat.pk)
        declined = seat.status == Participation.Status.DECLINED
        if declined and item is None:
            continue
        listed_seats.add(seat.pk)
        cast_rows.append(_row(
            key=seat.pk, origin=ORIGIN_CAST, item=item,
            contract=contracts.get(item.pk) if item else None,
            participation=seat, crew_assignment=None,
            billable=not declined, concert_day=concert_day, allocations=sources.cost_allocations,
        ))
    # Items whose seat was removed from the cast: never billable any more, and
    # still shown — as work if unpaid, as a counted cost if paid.
    for seat_id, item in by_seat.items():
        if seat_id in listed_seats or item.participation is None:
            continue
        cast_rows.append(_row(
            key=seat_id, origin=ORIGIN_CAST, item=item, contract=contracts.get(item.pk),
            participation=item.participation, crew_assignment=None,
            billable=False, concert_day=concert_day, allocations=sources.cost_allocations,
        ))
    cast_rows.sort(key=lambda row: _person_sort_key(row.payee_name))

    crew_rows = [
        _row(
            key=assignment.pk, origin=ORIGIN_CREW, item=by_crew.get(assignment.pk),
            contract=contracts.get(by_crew[assignment.pk].pk) if assignment.pk in by_crew else None,
            participation=None, crew_assignment=assignment,
            billable=True, concert_day=concert_day, allocations=sources.cost_allocations,
        )
        for assignment in sources.crew
    ]
    crew_rows.sort(key=lambda row: _person_sort_key(row.payee_name))

    one_off_rows = [
        _row(
            key=item.pk, origin=ORIGIN_ONE_OFF, item=item, contract=contracts.get(item.pk),
            participation=None, crew_assignment=None,
            billable=True, concert_day=concert_day, allocations=sources.cost_allocations,
        )
        for item in sources.items
        if item.participation_id is None and item.crew_assignment_id is None
    ]
    return cast_rows + crew_rows + one_off_rows


def _expense_rows(sources: _ProjectSources) -> list[ExpenseRow]:
    rows = [
        ExpenseRow(
            id=item.pk,
            category=item.category,
            budget_line_id=item.budget_line_id,
            vendor_name=item.vendor_name,
            vendor_nip=item.vendor_nip,
            document_type=item.document_type,
            document_number=item.document_number,
            document_date=item.document_date,
            description=item.description,
            cost_amount=item.cost_amount or ZERO,
            incurred_on=item.incurred_on,
            due_on=item.due_on,
            paid_on=item.paid_on,
            paid_marked_at=item.paid_marked_at,
            note=item.note,
            attachments=[
                AttachmentView(
                    id=attachment.pk,
                    original_name=attachment.original_name,
                    mime_type=attachment.mime_type,
                    size_bytes=attachment.size_bytes,
                    uploaded_at=attachment.created_at,
                )
                for attachment in sources.attachments.get(item.pk, [])
            ],
            allocations=sources.cost_allocations.get(item.pk, []),
        )
        for item in sources.expenses
    ]
    rows.sort(key=lambda row: (row.incurred_on, row.vendor_name.casefold()))
    return rows


def _plan_lines(sources: _ProjectSources, rows: list[LedgerRow], expenses: list[ExpenseRow]) -> list[PlanLineView]:
    """The plan in kosztorys order, each line with the counted costs charged to
    it, its split between sources, and the overrun those sources tolerate — the
    strictest tolerance among the sources the line's plan or its costs are
    charged to."""
    charged: dict[UUID, list[Decimal]] = {}
    counts: dict[UUID, int] = {}
    linked: dict[UUID, set[UUID]] = {}

    def charge(line_id: UUID | None, cost: Decimal, paid: bool, allocations: list[AllocationView]) -> None:
        if line_id is None:
            return
        totals = charged.setdefault(line_id, [ZERO, ZERO])
        totals[0] += cost
        if paid:
            totals[1] += cost
        counts[line_id] = counts.get(line_id, 0) + 1
        linked.setdefault(line_id, set()).update(allocation.funding_id for allocation in allocations)

    for row in rows:
        if row.counted:
            charge(row.budget_line_id, row.cost_amount or ZERO, row.is_paid, row.allocations)
    for expense in expenses:
        charge(expense.budget_line_id, expense.cost_amount, expense.is_paid, expense.allocations)

    tolerances = {funding.pk: funding.source.line_tolerance_pct for funding in sources.fundings}
    lines = sources.lines
    entries = {
        line.pk: PlanEntry(key=line.pk, category=line.category, position=line.position, created_at=line.created_at)
        for line in lines
    }
    numbers = plan_numbers(entries.values())
    ordered = sorted(lines, key=lambda line: plan_order(entries[line.pk]))
    views: list[PlanLineView] = []
    for line in ordered:
        planned = planned_amount(line.quantity, line.unit_cost)
        actual = money(charged.get(line.pk, [ZERO, ZERO])[0])
        allocations = sources.line_allocations.get(line.pk, [])
        funding_ids = linked.get(line.pk, set()) | {allocation.funding_id for allocation in allocations}
        tolerance = line_tolerance_pct(tolerances.get(funding_id) for funding_id in funding_ids)
        views.append(PlanLineView(
            id=line.pk,
            number=numbers[line.pk],
            section=plan_section(line.category),
            category=line.category,
            name=line.name,
            position=line.position,
            unit=line.unit,
            quantity=line.quantity,
            unit_cost=line.unit_cost,
            planned_amount=planned,
            note=line.note,
            actual=actual,
            paid=money(charged.get(line.pk, [ZERO, ZERO])[1]),
            cost_count=counts.get(line.pk, 0),
            allocations=allocations,
            tolerance_pct=tolerance,
            over_tolerance=exceeds_tolerance(actual, planned, tolerance),
        ))
    return views


def _funding_views(fundings: list[ProjectFunding], measures: Measures) -> list[FundingView]:
    """The project's sources, the ones bringing money first, each with its
    figures on this project and the source's own across all of them."""
    views: list[FundingView] = []
    for funding in fundings:
        figures = measures.fundings.get(funding.pk, FundingFigures())
        views.append(FundingView(
            id=funding.pk,
            source=measures.sources[funding.source_id],
            planned_amount=funding.planned_amount,
            received_amount=funding.received_amount,
            line_allocated=figures.line_allocated,
            charged=figures.charged,
            charged_count=figures.charged_count,
        ))
    views.sort(key=lambda view: (not view.brings_money, view.source.source.name.casefold()))
    return views


def _funding_summary(summary: Summary, fundings: list[FundingView]) -> FundingSummary:
    planned = received = charged = in_kind_planned = in_kind_contributed = ZERO
    for funding in fundings:
        if funding.brings_money:
            planned += funding.planned_amount
            received += funding.received_amount
            charged += funding.charged
            continue
        in_kind_planned += funding.planned_amount
        # Volunteer work is contributed as it is charged at its valuation; a
        # gift in kind as it is received.
        if funding.source.source.kind == FundingKind.VOLUNTEER_WORK:
            in_kind_contributed += funding.charged
        else:
            in_kind_contributed += funding.received_amount
    plan_uncovered = None
    if summary.planned is not None:
        plan_uncovered = money(summary.planned - planned - in_kind_planned)
    return FundingSummary(
        planned=money(planned),
        received=money(received),
        charged=money(charged),
        uncovered=money(summary.committed - charged),
        in_kind_planned=money(in_kind_planned),
        in_kind_contributed=money(in_kind_contributed),
        plan_uncovered=plan_uncovered,
    )


def _totals(committed: Decimal, paid: Decimal) -> Totals:
    return Totals(committed=money(committed), paid=money(paid), outstanding=money(committed - paid))


def _summary(rows: list[LedgerRow], expenses: list[ExpenseRow], lines: list[PlanLineView]) -> Summary:
    fee_committed = fee_paid = in_kind = unplanned = ZERO
    by_category: dict[str, list[Decimal]] = {}
    counts = {"priced": 0, "unpriced": 0, "paid": 0, "orphaned": 0, "volunteers": 0}
    for row in rows:
        if row.orphaned:
            counts["orphaned"] += 1
        if row.billable and not row.is_priced:
            counts["unpriced"] += 1
        if not row.counted:
            continue
        cost = row.cost_amount or ZERO
        fee_committed += cost
        if row.budget_line_id is None:
            unplanned += cost
        totals = by_category.setdefault(row.category, [ZERO, ZERO])
        totals[0] += cost
        counts["priced"] += 1
        if row.form == FeeForm.VOLUNTEER:
            counts["volunteers"] += 1
            in_kind += row.in_kind_value or ZERO
        if row.is_paid:
            fee_paid += cost
            totals[1] += cost
            counts["paid"] += 1

    expense_committed = expense_paid = ZERO
    for expense in expenses:
        expense_committed += expense.cost_amount
        if expense.budget_line_id is None:
            unplanned += expense.cost_amount
        totals = by_category.setdefault(expense.category, [ZERO, ZERO])
        totals[0] += expense.cost_amount
        if expense.is_paid:
            expense_paid += expense.cost_amount
            totals[1] += expense.cost_amount

    committed = fee_committed + expense_committed
    paid = fee_paid + expense_paid
    return Summary(
        committed=money(committed),
        paid=money(paid),
        outstanding=money(committed - paid),
        in_kind=money(in_kind),
        fees=_totals(fee_committed, fee_paid),
        expenses=_totals(expense_committed, expense_paid),
        planned=money(sum((line.planned_amount for line in lines), ZERO)) if lines else None,
        unplanned=money(unplanned),
        by_category=[
            CategoryTotal(category=category, committed=money(values[0]), paid=money(values[1]))
            for category, values in sorted(by_category.items())
        ],
        rows=len(rows),
        priced=counts["priced"],
        unpriced=counts["unpriced"],
        paid_count=counts["paid"],
        orphaned=counts["orphaned"],
        volunteers=counts["volunteers"],
        expense_count=len(expenses),
        lines=len(lines),
    )


def _warnings(
    project: Project,
    sources: _ProjectSources,
    rows: list[LedgerRow],
    expenses: list[ExpenseRow],
    lines: list[PlanLineView],
    fundings: list[FundingView],
    now: datetime,
    today: date,
) -> list[BudgetWarning]:
    """The §5.4 warnings, one entry per code naming every subject it concerns —
    a ledger row by its key, an expense, a plan line or a project funding by
    its id. Computed per request, so a time-relative one ("the concert has
    passed", "the report is due") is never stale on a client that stayed open."""
    concert_passed = project.date_time < now
    documents_due = project.date_time <= now + timedelta(days=DOCUMENT_DUE_WINDOW_DAYS)
    concert_day = local_date(project.date_time, project.timezone)
    has_plan = bool(lines)
    found: dict[str, list[UUID]] = {}
    params: dict[str, dict[str, Any]] = {}

    def flag(code: str, subject: UUID) -> None:
        found.setdefault(code, []).append(subject)

    minimum = minimum_hourly_rate(concert_day.year)
    volunteer_days = volunteer_period_days(sources.first_rehearsal, project, concert_day)

    for row in rows:
        contract = row.contract
        if row.billable and not row.is_priced:
            flag("UNPRICED", row.key)
        if row.orphaned:
            flag("ORPHANED_FEE", row.key)
        if row.is_paid and row.is_declined:
            flag("PAID_FOR_DECLINED", row.key)
        if row.counted and row.form == FeeForm.ZLECENIE and row.employer_contributions is None:
            flag("EMPLOYER_COST_MISSING", row.key)
        if row.counted and not row.is_paid and row.due_on is not None and row.due_on < today:
            flag("PAYMENT_OVERDUE", row.key)
        if row.is_paid and row.form in PAYABLE_CONTRACT_FORMS and contract is None and not row.paid_before_ledger:
            flag("PAID_WITHOUT_DOCUMENT", row.key)
        # A volunteer's 0 is no cost to place in a plan.
        if has_plan and row.counted and row.budget_line_id is None and row.form != FeeForm.VOLUNTEER:
            flag("COST_OUTSIDE_PLAN", row.key)
        if documents_due and row.counted:
            missing_contract = (
                row.form in PAYABLE_CONTRACT_FORMS and contract is None and not row.is_paid
            )
            missing_invoice = row.form == FeeForm.INVOICE and not row.document_number
            if missing_contract or missing_invoice:
                flag("DOCUMENT_MISSING", row.key)
        if contract is None or row.orphaned:
            continue
        if concert_passed and contract.status == ContractStatus.ISSUED:
            flag("NOT_SIGNED", row.key)
        if contract.form == FeeForm.ZLECENIE:
            if concert_passed and contract.hours_confirmed is None:
                flag("HOURS_MISSING", row.key)
            hours = contract.hours_confirmed
            if minimum is not None and hours is not None and hours > 0 and contract.amount / hours < minimum:
                flag("BELOW_MINIMUM_HOURLY_RATE", row.key)
                params["BELOW_MINIMUM_HOURLY_RATE"] = {"minimum": str(minimum), "year": concert_day.year}
        if contract.form == FeeForm.VOLUNTEER and volunteer_days <= VOLUNTEER_INSURANCE_MAX_DAYS:
            flag("VOLUNTEER_INSURANCE", row.key)
            params["VOLUNTEER_INSURANCE"] = {"period_days": volunteer_days}

    for expense in expenses:
        if not expense.is_paid and expense.due_on is not None and expense.due_on < today:
            flag("PAYMENT_OVERDUE", expense.id)
        if has_plan and expense.budget_line_id is None:
            flag("COST_OUTSIDE_PLAN", expense.id)

    # A line with no source stating a tolerance is over as soon as its actual
    # passes the planned amount.
    for line in lines:
        if line.over_tolerance:
            flag("LINE_OVER_PLAN", line.id)

    by_funding = {funding.id: funding.source.source for funding in fundings}
    charged_costs = [(row.key, row.incurred_on, row.allocations) for row in rows if row.counted]
    charged_costs += [(expense.id, expense.incurred_on, expense.allocations) for expense in expenses]
    for subject, incurred_on, allocations in charged_costs:
        if any(
            not is_eligible_on(incurred_on, source.eligible_from, source.eligible_to)
            for source in _allocated_sources(allocations, by_funding)
        ):
            flag("OUTSIDE_ELIGIBILITY", subject)

    for funding in fundings:
        source = funding.source.source
        figures = funding.source.figures
        if funding.overallocated:
            flag("SOURCE_OVERALLOCATED", funding.id)
        if figures.own_share_below:
            flag("OWN_SHARE_BELOW", funding.id)
        if figures.admin_cap_exceeded:
            flag("ADMIN_CAP_EXCEEDED", funding.id)
        if report_due_soon(source.status, source.report_due_on, today):
            flag("REPORT_DUE_SOON", funding.id)

    return [
        BudgetWarning(code=code, severity=severity, subject_ids=found[code], params=params.get(code, {}))
        for code, severity in WARNING_ORDER
        if code in found
    ]


def _allocated_sources(
    allocations: list[AllocationView], by_funding: dict[UUID, FundingSource],
) -> list[FundingSource]:
    return [by_funding[allocation.funding_id] for allocation in allocations if allocation.funding_id in by_funding]


def volunteer_period_days(first_rehearsal: datetime | None, project: Project, concert_day: date) -> int:
    """The volunteer's engagement: first rehearsal to concert, both days
    counted — "no longer than 30 days" is a count of calendar days. The
    agreement prints the same period and decides its insurance clause on it,
    so the warning and the paper cannot disagree."""
    if first_rehearsal is None:
        return 1
    start = local_date(first_rehearsal, project.timezone)
    return max((concert_day - start).days, 0) + 1


# Problems (crimson) first, then ordinary work (gold), each in the order of the
# spec's table. The client owns the words (`finance.warnings.<code>`).
WARNING_ORDER: tuple[tuple[str, str], ...] = (
    ("PAID_FOR_DECLINED", SEVERITY_PROBLEM),
    ("BELOW_MINIMUM_HOURLY_RATE", SEVERITY_PROBLEM),
    ("SOURCE_OVERALLOCATED", SEVERITY_PROBLEM),
    ("OUTSIDE_ELIGIBILITY", SEVERITY_PROBLEM),
    ("OWN_SHARE_BELOW", SEVERITY_PROBLEM),
    ("ADMIN_CAP_EXCEEDED", SEVERITY_PROBLEM),
    ("UNPRICED", SEVERITY_WORK),
    ("ORPHANED_FEE", SEVERITY_WORK),
    ("EMPLOYER_COST_MISSING", SEVERITY_WORK),
    ("HOURS_MISSING", SEVERITY_WORK),
    ("VOLUNTEER_INSURANCE", SEVERITY_WORK),
    ("NOT_SIGNED", SEVERITY_WORK),
    ("DOCUMENT_MISSING", SEVERITY_WORK),
    ("PAID_WITHOUT_DOCUMENT", SEVERITY_WORK),
    ("PAYMENT_OVERDUE", SEVERITY_WORK),
    ("COST_OUTSIDE_PLAN", SEVERITY_WORK),
    ("LINE_OVER_PLAN", SEVERITY_WORK),
    ("REPORT_DUE_SOON", SEVERITY_WORK),
)
