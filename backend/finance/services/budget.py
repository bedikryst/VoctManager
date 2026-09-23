"""
@file budget.py
@description The read side of a project's money: the ledger rows (including the
             unpriced rows computed from the roster at read time), the summary
             summed in Decimal, and the warnings. The client renders all three
             and computes none of them — so the hub tab, the global page and the
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

from ..exceptions import BudgetLocked
from ..models import (
    BudgetStatus,
    Contract,
    ContractStatus,
    CostItem,
    CostKind,
    FeeForm,
    ProjectBudget,
)
from ..rules import (
    DOCUMENT_DUE_WINDOW_DAYS,
    FINANCE_TIMEZONE,
    PAYABLE_CONTRACT_FORMS,
    VOLUNTEER_INSURANCE_MAX_DAYS,
    ZERO,
    category_for,
    default_form_for,
    in_kind_value,
    local_date,
    minimum_hourly_rate,
    money,
    payee_snapshot,
)

ORIGIN_CAST = "cast"
ORIGIN_CREW = "crew"
ORIGIN_ONE_OFF = "one_off"

SEVERITY_WORK = "work"
SEVERITY_PROBLEM = "problem"


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

    @property
    def is_priced(self) -> bool:
        return self.cost_item_id is not None and self.contract_amount is not None

    @property
    def is_paid(self) -> bool:
        return self.paid_on is not None


@dataclass(frozen=True)
class CategoryTotal:
    category: str
    committed: Decimal
    paid: Decimal


@dataclass(frozen=True)
class Summary:
    committed: Decimal
    paid: Decimal
    outstanding: Decimal
    in_kind: Decimal
    by_category: list[CategoryTotal]
    rows: int
    priced: int
    unpriced: int
    paid_count: int
    orphaned: int
    volunteers: int


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
    summary: Summary
    warnings: list[BudgetWarning]

    @property
    def budget_status(self) -> str:
        return self.budget.status if self.budget is not None else BudgetStatus.PLANNING


@dataclass
class _ProjectSources:
    """Everything one project's ledger is computed from, loaded in bulk."""

    items: list[CostItem] = field(default_factory=list)
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
        results: list[ProjectMoney] = []
        for project in projects:
            project_sources = sources.get(project.pk, _ProjectSources())
            rows = _rows(project, project_sources, contracts)
            results.append(
                ProjectMoney(
                    project=project,
                    budget=budgets.get(project.pk),
                    rows=rows,
                    summary=_summary(rows),
                    warnings=_warnings(project, project_sources, rows, moment, today),
                )
            )
        return results

    @staticmethod
    def payables() -> models.QuerySet[CostItem]:
        """Fees the foundation still owes, across every project: priced above
        zero, unpaid, and still counted (a paid-out orphan is not a payable, and
        an unpaid one is work on its project, not a debt)."""
        return (
            CostItem.objects.filter(
                kind=CostKind.FEE,
                contract_amount__gt=0,
                paid_on__isnull=True,
                budget__project__is_deleted=False,
            )
            .filter(
                models.Q(participation__isnull=True)
                | (
                    models.Q(participation__is_deleted=False)
                    & ~models.Q(participation__status=Participation.Status.DECLINED)
                )
            )
            .select_related('budget__project')
            .order_by(models.F('due_on').asc(nulls_last=True), 'incurred_on', 'payee_name')
        )


def _load_sources(projects: Sequence[Project]) -> dict[UUID, _ProjectSources]:
    ids = [project.pk for project in projects]
    sources: dict[UUID, _ProjectSources] = {pk: _ProjectSources() for pk in ids}
    items = (
        CostItem.objects.filter(kind=CostKind.FEE, budget__project__in=ids)
        .select_related('budget', 'participation__artist', 'crew_assignment__collaborator')
        .order_by('created_at')
    )
    for item in items:
        sources[item.budget.project_id].items.append(item)
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
            form=default_form or "", default_form=default_form,
            contract_amount=None, employer_contributions=None, cost_amount=None,
            in_kind_hours=None, in_kind_hourly_rate=None, in_kind_value=None,
            incurred_on=concert_day, due_on=None, paid_on=None, paid_marked_at=None,
            document_number="", document_date=None, vendor_nip="", note="",
            contract=None,
        )

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
        form=item.form, default_form=default_form,
        contract_amount=item.contract_amount,
        employer_contributions=item.employer_contributions,
        cost_amount=item.cost_amount,
        in_kind_hours=item.in_kind_hours,
        in_kind_hourly_rate=item.in_kind_hourly_rate,
        in_kind_value=in_kind_value(item.in_kind_hours, item.in_kind_hourly_rate),
        incurred_on=item.incurred_on,
        due_on=item.due_on,
        paid_on=item.paid_on,
        paid_marked_at=item.paid_marked_at,
        document_number=item.document_number,
        document_date=item.document_date,
        vendor_nip=item.vendor_nip,
        note=item.note,
        contract=_contract_view(contract),
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
            billable=not declined, concert_day=concert_day,
        ))
    # Items whose seat was removed from the cast: never billable any more, and
    # still shown — as work if unpaid, as a counted cost if paid.
    for seat_id, item in by_seat.items():
        if seat_id in listed_seats or item.participation is None:
            continue
        cast_rows.append(_row(
            key=seat_id, origin=ORIGIN_CAST, item=item, contract=contracts.get(item.pk),
            participation=item.participation, crew_assignment=None,
            billable=False, concert_day=concert_day,
        ))
    cast_rows.sort(key=lambda row: _person_sort_key(row.payee_name))

    crew_rows = [
        _row(
            key=assignment.pk, origin=ORIGIN_CREW, item=by_crew.get(assignment.pk),
            contract=contracts.get(by_crew[assignment.pk].pk) if assignment.pk in by_crew else None,
            participation=None, crew_assignment=assignment,
            billable=True, concert_day=concert_day,
        )
        for assignment in sources.crew
    ]
    crew_rows.sort(key=lambda row: _person_sort_key(row.payee_name))

    one_off_rows = [
        _row(
            key=item.pk, origin=ORIGIN_ONE_OFF, item=item, contract=contracts.get(item.pk),
            participation=None, crew_assignment=None,
            billable=True, concert_day=concert_day,
        )
        for item in sources.items
        if item.participation_id is None and item.crew_assignment_id is None
    ]
    return cast_rows + crew_rows + one_off_rows


def _summary(rows: list[LedgerRow]) -> Summary:
    committed = paid = in_kind = ZERO
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
        committed += cost
        totals = by_category.setdefault(row.category, [ZERO, ZERO])
        totals[0] += cost
        counts["priced"] += 1
        if row.form == FeeForm.VOLUNTEER:
            counts["volunteers"] += 1
            in_kind += row.in_kind_value or ZERO
        if row.is_paid:
            paid += cost
            totals[1] += cost
            counts["paid"] += 1
    return Summary(
        committed=money(committed),
        paid=money(paid),
        outstanding=money(committed - paid),
        in_kind=money(in_kind),
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
    )


def _warnings(
    project: Project,
    sources: _ProjectSources,
    rows: list[LedgerRow],
    now: datetime,
    today: date,
) -> list[BudgetWarning]:
    """The §5.4 warnings this stage's data can raise, one entry per code naming
    every row it concerns. Computed per request, so a time-relative one ("the
    concert has passed") is never stale on a client that stayed open."""
    concert_passed = project.date_time < now
    documents_due = project.date_time <= now + timedelta(days=DOCUMENT_DUE_WINDOW_DAYS)
    concert_day = local_date(project.date_time, project.timezone)
    found: dict[str, list[UUID]] = {}
    params: dict[str, dict[str, Any]] = {}

    def flag(code: str, row: LedgerRow) -> None:
        found.setdefault(code, []).append(row.key)

    minimum = minimum_hourly_rate(concert_day.year)
    volunteer_days = volunteer_period_days(sources.first_rehearsal, project, concert_day)

    for row in rows:
        contract = row.contract
        if row.billable and not row.is_priced:
            flag("UNPRICED", row)
        if row.orphaned:
            flag("ORPHANED_FEE", row)
        if row.is_paid and row.is_declined:
            flag("PAID_FOR_DECLINED", row)
        if row.counted and row.form == FeeForm.ZLECENIE and row.employer_contributions is None:
            flag("EMPLOYER_COST_MISSING", row)
        if row.counted and not row.is_paid and row.due_on is not None and row.due_on < today:
            flag("PAYMENT_OVERDUE", row)
        if row.is_paid and row.form in PAYABLE_CONTRACT_FORMS and contract is None:
            flag("PAID_WITHOUT_DOCUMENT", row)
        if documents_due and row.counted:
            missing_contract = (
                row.form in PAYABLE_CONTRACT_FORMS and contract is None and not row.is_paid
            )
            missing_invoice = row.form == FeeForm.INVOICE and not row.document_number
            if missing_contract or missing_invoice:
                flag("DOCUMENT_MISSING", row)
        if contract is None or row.orphaned:
            continue
        if concert_passed and contract.status == ContractStatus.ISSUED:
            flag("NOT_SIGNED", row)
        if contract.form == FeeForm.ZLECENIE:
            if concert_passed and contract.hours_confirmed is None:
                flag("HOURS_MISSING", row)
            hours = contract.hours_confirmed
            if minimum is not None and hours is not None and hours > 0 and contract.amount / hours < minimum:
                flag("BELOW_MINIMUM_HOURLY_RATE", row)
                params["BELOW_MINIMUM_HOURLY_RATE"] = {"minimum": str(minimum), "year": concert_day.year}
        if contract.form == FeeForm.VOLUNTEER and volunteer_days <= VOLUNTEER_INSURANCE_MAX_DAYS:
            flag("VOLUNTEER_INSURANCE", row)
            params["VOLUNTEER_INSURANCE"] = {"period_days": volunteer_days}

    return [
        BudgetWarning(code=code, severity=severity, subject_ids=found[code], params=params.get(code, {}))
        for code, severity in WARNING_ORDER
        if code in found
    ]


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
    ("UNPRICED", SEVERITY_WORK),
    ("ORPHANED_FEE", SEVERITY_WORK),
    ("EMPLOYER_COST_MISSING", SEVERITY_WORK),
    ("HOURS_MISSING", SEVERITY_WORK),
    ("VOLUNTEER_INSURANCE", SEVERITY_WORK),
    ("NOT_SIGNED", SEVERITY_WORK),
    ("DOCUMENT_MISSING", SEVERITY_WORK),
    ("PAID_WITHOUT_DOCUMENT", SEVERITY_WORK),
    ("PAYMENT_OVERDUE", SEVERITY_WORK),
)
