"""
@file reports.py
@description What the reports and exports say, computed from the budget's own
             figures (`services/budget.py`), so a report can never state a
             number the panel does not. The words are the renderer's; this
             module decides which figures exist:

             - the patron report's cost and funding structure, and one source's
               share of the cost, under the privacy floor: a printed figure
               derived from fees aggregates at least `PATRON_PAYEE_FLOOR`
               payees or blends them with a cost that is not pay, and so does
               anything a reader gets by subtracting one printed figure from
               another — or it is merged into another row, never dropped;
             - the board report's plan against actual, its warnings with the
               names of what they concern, and what is still owed;
             - the kosztorys, planned or actual, per line and split between the
               four columns of a public-benefit kosztorys;
             - the documents charged to a source, which get a note on the back.
@architecture Enterprise SaaS 2026
@module finance/services/reports
"""
from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import date
from decimal import Decimal
from uuid import UUID

from ..exceptions import ReportSourceInvalid
from ..models import FEE_CATEGORIES, BudgetStatus, CostCategory, FeeForm, FundingKind
from ..rules import (
    HUNDRED,
    PAYABLE_CONTRACT_FORMS,
    PLAN_SECTION_ACTIVITIES,
    PLAN_SECTION_ADMINISTRATION,
    ZERO,
    money,
    plan_section,
)
from .budget import AllocationView, BudgetWarning, FundingView, PlanLineView, ProjectMoney

# A figure derived from fees must sum at least this many people's fees before a
# patron sees it: with fewer, one person's fee can be read off it.
PATRON_PAYEE_FLOOR = 3

# Keys of the patron report's rows beyond the categories and funding kinds.
PERSONNEL_MERGED = "PERSONNEL"
REMAINDER = "REMAINDER"
FOUNDATION_OWN = "OWN"
FUNDING_MERGED = "OTHER_SOURCES"

_CATEGORY_ORDER: dict[str, int] = {category: index for index, category in enumerate(CostCategory)}
_KIND_ORDER: dict[str, int] = {kind: index for index, kind in enumerate(FundingKind)}


# --------------------------------------------------------------------------- #
# Patron report                                                                #
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CategoryCost:
    """What one category costs, and how many people's fees make up the figure
    (0 for an expense category: nobody's pay can be read off a venue)."""

    category: str
    amount: Decimal
    payees: int


@dataclass(frozen=True)
class Share:
    """One row of a structure: a category, a funding kind, or one of the merged
    rows (`PERSONNEL_MERGED`, `REMAINDER`, `FOUNDATION_OWN`), with its part of
    the whole in per cent."""

    key: str
    amount: Decimal
    pct: Decimal


def _shares(entries: Sequence[tuple[str, Decimal]], whole: Decimal) -> list[Share]:
    if whole <= ZERO:
        return []
    return [
        Share(key=key, amount=amount, pct=(amount * HUNDRED / whole).quantize(Decimal("0.1")))
        for key, amount in entries
    ]


def _largest_first(rows: list[tuple[str, Decimal]]) -> list[tuple[str, Decimal]]:
    return sorted(rows, key=lambda row: (-row[1], _CATEGORY_ORDER.get(row[0], len(_CATEGORY_ORDER))))


def _cost_groups(costs: Sequence[CategoryCost]) -> dict[str, str]:
    """The printed row each category's cost lands in, under the floor; empty
    when the structure prints no row at all.

    A personnel category is printed on its own only when every personnel
    category holds the fees of at least `PATRON_PAYEE_FLOOR` people. Otherwise
    the personnel categories merge into one row, which the floor then applies
    to as a whole. When even together they sum fewer people's fees, personnel
    has no row of its own — and since the rows sum to the total, which is
    printed, a missing row would be read back by subtraction. So the personnel
    cost joins the largest other category in a `REMAINDER` row, and when there
    is no other category, the structure is empty and the total stands alone.
    """
    personnel = [cost for cost in costs if cost.category in FEE_CATEGORIES and cost.amount > ZERO]
    others = [cost for cost in costs if cost.category not in FEE_CATEGORIES and cost.amount > ZERO]
    groups = {cost.category: cost.category for cost in others}
    if all(cost.payees >= PATRON_PAYEE_FLOOR for cost in personnel):
        return groups | {cost.category: cost.category for cost in personnel}
    if sum(cost.payees for cost in personnel) >= PATRON_PAYEE_FLOOR:
        return groups | {cost.category: PERSONNEL_MERGED for cost in personnel}
    if not others:
        return {}
    absorbing = max(others, key=lambda cost: (cost.amount, -_CATEGORY_ORDER.get(cost.category, 0)))
    return groups | {cost.category: REMAINDER for cost in [absorbing, *personnel]}


def floored_cost_structure(costs: Sequence[CategoryCost]) -> list[tuple[str, Decimal]]:
    """The cost structure a patron may see, largest first, with a `REMAINDER`
    row last. `_cost_groups` says which rows exist."""
    groups = _cost_groups(costs)
    amounts: dict[str, Decimal] = {}
    for cost in costs:
        key = groups.get(cost.category)
        if key is not None:
            amounts[key] = amounts.get(key, ZERO) + cost.amount
    remainder = amounts.pop(REMAINDER, None)
    rows = _largest_first([(key, money(amount)) for key, amount in amounts.items()])
    return rows if remainder is None else [*rows, (REMAINDER, money(remainder))]


@dataclass(frozen=True)
class _Part:
    """What a printed figure is made of, as far as the floor cares: the fee
    rows with a positive part in it — one per person paid — and how much of it
    is nobody's pay (an expense)."""

    payees: frozenset[UUID] = frozenset()
    other: Decimal = ZERO

    def __or__(self, part: "_Part") -> "_Part":
        return _Part(payees=self.payees | part.payees, other=self.other + part.other)

    @property
    def floored(self) -> bool:
        """Nobody's pay can be read off it: it holds no fee, the fees of at
        least the floor's number of people, or a cost that is not pay, which
        the fees in it cannot be told apart from."""
        return not self.payees or len(self.payees) >= PATRON_PAYEE_FLOOR or self.other > ZERO


@dataclass(frozen=True)
class _Cost:
    """One counted cost with a positive amount: a fee (its row's key is the
    payee) or an expense (no payee)."""

    category: str
    amount: Decimal
    payee: UUID | None
    allocations: list[AllocationView]

    def part(self, amount: Decimal) -> _Part:
        if amount <= ZERO:
            return _Part()
        if self.payee is None:
            return _Part(other=amount)
        return _Part(payees=frozenset({self.payee}))


def _counted_costs(money_: ProjectMoney) -> list[_Cost]:
    fees = [
        _Cost(category=row.category, amount=row.cost_amount or ZERO, payee=row.key, allocations=row.allocations)
        for row in money_.rows
        if row.counted and (row.cost_amount or ZERO) > ZERO
    ]
    expenses = [
        _Cost(category=expense.category, amount=expense.cost_amount, payee=None, allocations=expense.allocations)
        for expense in money_.expenses
        if expense.cost_amount > ZERO
    ]
    return fees + expenses


@dataclass(frozen=True)
class _Figure:
    """A row about to be printed. Every part must pass the floor: the row's own,
    and — where the reader can subtract the row from a printed figure — what
    that subtraction leaves."""

    key: str
    amount: Decimal
    parts: tuple[_Part, ...]

    @property
    def floored(self) -> bool:
        return all(part.floored for part in self.parts)

    def merged(self, figure: "_Figure", key: str) -> "_Figure":
        return _Figure(
            key=key,
            amount=self.amount + figure.amount,
            parts=tuple(mine | theirs for mine, theirs in zip(self.parts, figure.parts, strict=True)),
        )


def _floor_figures(figures: list[_Figure], merged_key: str) -> list[_Figure]:
    """The rows as printed: the ones that pass the floor, and the rest merged
    into one `merged_key` row — never dropped, since the rows sum to a printed
    whole and a missing one is read back by subtraction. When even merged they
    fail, they join the `merged_key` row if there is one, else the largest row
    that passes. With no such row, nothing is printed."""
    passing = [figure for figure in figures if figure.floored]
    failing = [figure for figure in figures if not figure.floored]
    if not failing:
        return passing
    merged = failing[0]
    for figure in failing[1:]:
        merged = merged.merged(figure, merged_key)
    merged = replace(merged, key=merged_key)
    host = next((figure for figure in passing if figure.key == merged_key), None)
    if host is None and not merged.floored:
        host = max(passing, key=lambda figure: figure.amount, default=None)
        if host is None:
            return []
    if host is None:
        return [*passing, merged]
    return [figure for figure in passing if figure is not host] + [host.merged(merged, merged_key)]


def _category_costs(money_: ProjectMoney) -> list[CategoryCost]:
    """The counted cost per category, and the people whose fee is in it."""
    amounts: dict[str, Decimal] = {}
    payees: dict[str, int] = {}
    for cost in _counted_costs(money_):
        amounts[cost.category] = amounts.get(cost.category, ZERO) + cost.amount
        if cost.payee is not None:
            payees[cost.category] = payees.get(cost.category, 0) + 1
    return [
        CategoryCost(category=category, amount=money(amount), payees=payees.get(category, 0))
        for category, amount in amounts.items()
    ]


@dataclass(frozen=True)
class PatronHighlight:
    """What one source's money covered on the project, in the whole report's
    rows or coarser, under the same floor. `covered` is None, and the structure
    empty, when what the source paid for, or what it left to others, would be
    one or two people's pay: the report then names the source and says it
    covered part of the costs."""

    funding: FundingView
    covered: Decimal | None
    structure: list[Share]


def _highlight(money_: ProjectMoney, funding: FundingView, groups: dict[str, str]) -> PatronHighlight:
    """The source's share, grouped by the whole report's rows (`groups`), never
    finer: a highlight row inside a whole row would be subtracted from it.
    Each highlight row is floored twice — the share itself, and what the whole
    row holds beyond it, which the reader gets by that subtraction — and so is
    `covered`, against the total."""
    covered = ZERO
    shares: dict[str, Decimal] = {}
    share_parts: dict[str, _Part] = {}
    rest_parts: dict[str, _Part] = {}
    covered_part = uncovered_part = _Part()
    for cost in _counted_costs(money_):
        share = money(sum((a.amount for a in cost.allocations if a.funding_id == funding.id), ZERO))
        rest = cost.amount - share
        covered += share
        covered_part |= cost.part(share)
        uncovered_part |= cost.part(rest)
        key = groups.get(cost.category)
        if key is None:
            continue
        shares[key] = shares.get(key, ZERO) + share
        share_parts[key] = share_parts.get(key, _Part()) | cost.part(share)
        rest_parts[key] = rest_parts.get(key, _Part()) | cost.part(rest)

    if not (covered_part.floored and uncovered_part.floored):
        return PatronHighlight(funding=funding, covered=None, structure=[])
    covered = money(covered)

    figures = [
        _Figure(key=key, amount=money(amount), parts=(share_parts[key], rest_parts[key]))
        for key, amount in shares.items()
        if amount > ZERO
    ]
    printed = _floor_figures(figures, REMAINDER)
    remainder = [(figure.key, figure.amount) for figure in printed if figure.key == REMAINDER]
    rows = _largest_first([(figure.key, figure.amount) for figure in printed if figure.key != REMAINDER])
    return PatronHighlight(funding=funding, covered=covered, structure=_shares([*rows, *remainder], covered))


@dataclass(frozen=True)
class PatronReport:
    """`is_draft` until the budget is closed: before that, every figure may
    still move. `funding` sums to `total`: what each kind of source carries,
    and the foundation's own for the rest. `in_kind` is what came without
    money — gifts in kind, and volunteers' work once enough volunteers make up
    its valuation."""

    money: ProjectMoney
    is_draft: bool
    total: Decimal
    structure: list[Share]
    funding: list[Share]
    in_kind: list[Share]
    highlight: PatronHighlight | None


def report_funding(money_: ProjectMoney, source_id: UUID | None) -> FundingView | None:
    """The project's funding from the named source, which must bring money: a
    report can say what money covered, a document note describes a payment.
    None when no source is named."""
    if source_id is None:
        return None
    for funding in money_.fundings:
        if funding.source.source.pk == source_id:
            if not funding.brings_money:
                raise ReportSourceInvalid()
            return funding
    raise ReportSourceInvalid()


def _funding_structure(money_: ProjectMoney) -> list[tuple[str, Decimal]]:
    """What each kind of source carries, largest first, then the foundation's
    own (its own funds and whatever no source carries), then the merged row.
    A kind that carries nothing but one or two people's pay merges: a sponsor
    who paid only the soloist would otherwise find the soloist's fee here."""
    kind_of: dict[UUID, str] = {}
    amounts: dict[str, Decimal] = {FOUNDATION_OWN: money_.funding.uncovered}
    for funding in money_.fundings:
        if not funding.brings_money:
            continue
        kind = funding.source.source.kind
        key = FOUNDATION_OWN if kind == FundingKind.OWN_FUNDS else kind
        kind_of[funding.id] = key
        amounts[key] = amounts.get(key, ZERO) + funding.charged

    parts: dict[str, _Part] = {}
    for cost in _counted_costs(money_):
        carried = ZERO
        for allocation in cost.allocations:
            carrier = kind_of.get(allocation.funding_id)
            if carrier is None:
                continue
            parts[carrier] = parts.get(carrier, _Part()) | cost.part(allocation.amount)
            carried += allocation.amount
        parts[FOUNDATION_OWN] = parts.get(FOUNDATION_OWN, _Part()) | cost.part(cost.amount - carried)

    printed = _floor_figures(
        [
            _Figure(key=key, amount=money(amount), parts=(parts.get(key, _Part()),))
            for key, amount in amounts.items()
            if amount > ZERO
        ],
        FUNDING_MERGED,
    )

    def order(figure: _Figure) -> tuple[int, Decimal, int]:
        rank = {FOUNDATION_OWN: 1, FUNDING_MERGED: 2}.get(figure.key, 0)
        return (rank, -figure.amount, _KIND_ORDER.get(figure.key, 0))

    return [(figure.key, figure.amount) for figure in sorted(printed, key=order)]


def _in_kind(money_: ProjectMoney) -> list[tuple[str, Decimal]]:
    """Gifts in kind at their received value; volunteers' work at its charged
    valuation, and only when at least the floor's number of volunteers make it
    up — one volunteer's hours times their rate is theirs alone."""
    gifts = ZERO
    work = ZERO
    volunteer_fundings: set[UUID] = set()
    for funding in money_.fundings:
        kind = funding.source.source.kind
        if kind == FundingKind.IN_KIND:
            gifts += funding.received_amount
        elif kind == FundingKind.VOLUNTEER_WORK:
            work += funding.charged
            volunteer_fundings.add(funding.id)
    volunteers = sum(
        1 for row in money_.rows
        if row.counted and any(a.funding_id in volunteer_fundings and a.amount > ZERO for a in row.allocations)
    )
    entries: list[tuple[str, Decimal]] = []
    if gifts > ZERO:
        entries.append((FundingKind.IN_KIND, money(gifts)))
    if work > ZERO and volunteers >= PATRON_PAYEE_FLOOR:
        entries.append((FundingKind.VOLUNTEER_WORK, money(work)))
    return entries


def patron_report(money_: ProjectMoney, *, source_id: UUID | None = None) -> PatronReport:
    total = money_.summary.committed
    costs = _category_costs(money_)
    funding = report_funding(money_, source_id)
    in_kind = _in_kind(money_)
    return PatronReport(
        money=money_,
        is_draft=money_.budget_status != BudgetStatus.CLOSED,
        total=total,
        structure=_shares(floored_cost_structure(costs), total),
        funding=_shares(_funding_structure(money_), total),
        in_kind=[Share(key=key, amount=amount, pct=ZERO) for key, amount in in_kind],
        highlight=None if funding is None else _highlight(money_, funding, _cost_groups(costs)),
    )


# --------------------------------------------------------------------------- #
# Board report                                                                 #
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class LineComparison:
    """A plan line against what it actually cost. `line` is None for the
    counted cost charged to no line."""

    line: PlanLineView | None
    planned: Decimal | None
    actual: Decimal
    deviation: Decimal | None
    deviation_pct: Decimal | None


def plan_comparison(money_: ProjectMoney) -> list[LineComparison]:
    comparisons = [
        LineComparison(
            line=line,
            planned=line.planned_amount,
            actual=line.actual,
            deviation=money(line.actual - line.planned_amount),
            deviation_pct=(
                ((line.actual - line.planned_amount) * HUNDRED / line.planned_amount).quantize(Decimal("0.1"))
                if line.planned_amount > ZERO else None
            ),
        )
        for line in money_.lines
    ]
    if money_.summary.unplanned > ZERO:
        comparisons.append(LineComparison(
            line=None, planned=None, actual=money_.summary.unplanned, deviation=None, deviation_pct=None,
        ))
    return comparisons


@dataclass(frozen=True)
class NamedWarning:
    warning: BudgetWarning
    subjects: list[str]


def named_warnings(money_: ProjectMoney) -> list[NamedWarning]:
    """Each warning with the names of what it concerns: a person, an expense's
    vendor and document, a kosztorys line, a source."""
    names: dict[UUID, str] = {row.key: row.payee_name for row in money_.rows}
    names.update({
        expense.id: " ".join(part for part in (expense.vendor_name, expense.document_number) if part)
        for expense in money_.expenses
    })
    names.update({line.id: f"{line.number} {line.name}" for line in money_.lines})
    names.update({funding.id: funding.source.source.name for funding in money_.fundings})
    return [
        NamedWarning(warning=warning, subjects=[names[subject] for subject in warning.subject_ids if subject in names])
        for warning in money_.warnings
    ]


@dataclass(frozen=True)
class Payable:
    name: str
    amount: Decimal
    due_on: date | None
    is_fee: bool


def payables(money_: ProjectMoney) -> list[Payable]:
    """What the project still owes: counted fees above zero and expenses, not
    yet paid, the earliest due first and the undated last."""
    owed = [
        Payable(name=row.payee_name, amount=row.cost_amount or ZERO, due_on=row.due_on, is_fee=True)
        for row in money_.rows
        if row.counted and not row.is_paid and (row.cost_amount or ZERO) > ZERO
    ]
    owed += [
        Payable(name=expense.vendor_name, amount=expense.cost_amount, due_on=expense.due_on, is_fee=False)
        for expense in money_.expenses
        if not expense.is_paid
    ]
    return sorted(owed, key=lambda payable: (payable.due_on is None, payable.due_on or date.max, payable.name))


# --------------------------------------------------------------------------- #
# Kosztorys                                                                    #
# --------------------------------------------------------------------------- #

# The columns a line's value is split into, as the public-benefit form names
# them, and what no source carries yet — written out rather than silently
# assigned to one of the four.
COLUMN_GRANT = "grant"
COLUMN_OTHER_MONEY = "other_money"
COLUMN_PERSONAL = "personal"
COLUMN_MATERIAL = "material"
COLUMN_UNASSIGNED = "unassigned"
SPLIT_COLUMNS = (COLUMN_GRANT, COLUMN_OTHER_MONEY, COLUMN_PERSONAL, COLUMN_MATERIAL, COLUMN_UNASSIGNED)

VARIANT_PLAN = "plan"
VARIANT_ACTUAL = "actual"


@dataclass
class KosztorysRow:
    """A line of the kosztorys, or the costs of a section charged to no line
    (`line` None). `value` is the sum of the split: the money cost plus what
    volunteers' work and gifts in kind contribute to it."""

    section: str
    line: PlanLineView | None
    split: dict[str, Decimal] = field(default_factory=lambda: {column: ZERO for column in SPLIT_COLUMNS})

    @property
    def value(self) -> Decimal:
        return money(sum(self.split.values(), ZERO))


@dataclass(frozen=True)
class KosztorysSection:
    section: str
    rows: list[KosztorysRow]

    def total(self, column: str) -> Decimal:
        return money(sum((row.split[column] for row in self.rows), ZERO))

    @property
    def value(self) -> Decimal:
        return money(sum((row.value for row in self.rows), ZERO))


def _column_for(money_: ProjectMoney, grant_ids: set[UUID]) -> dict[UUID, str]:
    columns: dict[UUID, str] = {}
    for funding in money_.fundings:
        kind = funding.source.source.kind
        if funding.id in grant_ids:
            columns[funding.id] = COLUMN_GRANT
        elif kind == FundingKind.VOLUNTEER_WORK:
            columns[funding.id] = COLUMN_PERSONAL
        elif kind == FundingKind.IN_KIND:
            columns[funding.id] = COLUMN_MATERIAL
        else:
            columns[funding.id] = COLUMN_OTHER_MONEY
    return columns


def grant_fundings(money_: ProjectMoney, source_id: UUID | None) -> set[UUID]:
    """The fundings the "z dotacji" column reads: the named source's, or, when
    none is named, every public grant's — "dotacja" is public money, and a
    private grant is one of the other financial means."""
    funding = report_funding(money_, source_id)
    if funding is not None:
        return {funding.id}
    return {f.id for f in money_.fundings if f.source.source.kind == FundingKind.PUBLIC_GRANT}


_MONEY_COLUMNS = (COLUMN_GRANT, COLUMN_OTHER_MONEY)


def _add(
    row: KosztorysRow,
    allocations: list[AllocationView],
    columns: dict[UUID, str],
    amount: Decimal,
    *,
    carried_by: tuple[str, ...],
) -> None:
    """Splits one amount onto a row: each source's share into its column, and
    what the ``carried_by`` columns leave of ``amount`` into `unassigned`.

    On the plan every share is part of the line's planned amount, whatever its
    kind. On the actuals the amount is a money cost, carried only by money: a
    volunteer's valuation is charged to volunteer work on top of a cost of 0,
    and adds to the value instead of covering it."""
    carried = ZERO
    for allocation in allocations:
        column = columns.get(allocation.funding_id, COLUMN_OTHER_MONEY)
        row.split[column] += allocation.amount
        if column in carried_by:
            carried += allocation.amount
    row.split[COLUMN_UNASSIGNED] += amount - carried


def _in_kind_by_line(money_: ProjectMoney) -> tuple[dict[UUID, Decimal], Decimal]:
    """Gifts in kind have no cost row, so their received value reaches the
    actual kosztorys through the plan: shared between the lines the plan
    split each gift to, in the plan's proportions, the last line taking the
    rounding. A gift the plan placed on no line is returned apart."""
    by_line: dict[UUID, Decimal] = {}
    unplaced = ZERO
    for funding in money_.fundings:
        if funding.source.source.kind != FundingKind.IN_KIND or funding.received_amount <= ZERO:
            continue
        splits = [
            (line.id, allocation.amount)
            for line in money_.lines
            for allocation in line.allocations
            if allocation.funding_id == funding.id and allocation.amount > ZERO
        ]
        planned = sum((amount for _, amount in splits), ZERO)
        if planned <= ZERO:
            unplaced += funding.received_amount
            continue
        left = funding.received_amount
        for index, (line_id, amount) in enumerate(splits):
            share = left if index == len(splits) - 1 else money(funding.received_amount * amount / planned)
            by_line[line_id] = by_line.get(line_id, ZERO) + share
            left -= share
    return by_line, unplaced


def kosztorys(money_: ProjectMoney, *, variant: str, source_id: UUID | None = None) -> list[KosztorysSection]:
    """The kosztorys in its two sections, each line split between the columns.

    The plan splits a line's planned amount by its plan allocations. The actual
    splits the counted costs charged to each line by their cost allocations,
    and adds a row per section for the costs charged to no line, so the
    sections sum to the project's cost (plus what came in kind)."""
    columns = _column_for(money_, grant_fundings(money_, source_id))
    sections: dict[str, list[KosztorysRow]] = {PLAN_SECTION_ACTIVITIES: [], PLAN_SECTION_ADMINISTRATION: []}
    rows: dict[UUID, KosztorysRow] = {}
    for line in money_.lines:
        row = KosztorysRow(section=line.section, line=line)
        rows[line.id] = row
        sections[line.section].append(row)
        if variant == VARIANT_PLAN:
            _add(row, line.allocations, columns, line.planned_amount, carried_by=SPLIT_COLUMNS)

    if variant == VARIANT_ACTUAL:
        unplanned = {section: KosztorysRow(section=section, line=None) for section in sections}
        for ledger_row in money_.rows:
            if ledger_row.counted:
                target = rows.get(ledger_row.budget_line_id) if ledger_row.budget_line_id else None
                target = target or unplanned[plan_section(ledger_row.category)]
                _add(
                    target, ledger_row.allocations, columns, ledger_row.cost_amount or ZERO,
                    carried_by=_MONEY_COLUMNS,
                )
        for expense in money_.expenses:
            target = rows.get(expense.budget_line_id) if expense.budget_line_id else None
            target = target or unplanned[plan_section(expense.category)]
            _add(target, expense.allocations, columns, expense.cost_amount, carried_by=_MONEY_COLUMNS)
        by_line, unplaced = _in_kind_by_line(money_)
        for line_id, amount in by_line.items():
            rows[line_id].split[COLUMN_MATERIAL] += amount
        unplanned[PLAN_SECTION_ACTIVITIES].split[COLUMN_MATERIAL] += unplaced
        for section, row in unplanned.items():
            if row.value != ZERO:
                sections[section].append(row)

    for section_rows in sections.values():
        for row in section_rows:
            for column in SPLIT_COLUMNS:
                row.split[column] = money(row.split[column])
    return [KosztorysSection(section=section, rows=section_rows) for section, section_rows in sections.items()]


# --------------------------------------------------------------------------- #
# Document notes                                                               #
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ChargedDocument:
    """An accounting document behind a cost charged to at least one source.

    For a dzieło or a zlecenie the document is the bill, which carries the
    contract's number; for an invoiced fee and an expense, the vendor's own.
    `amount` is the document's: a fee's contract amount (a mandate's employer
    contributions are declared to ZUS, not billed), an expense's gross.
    """

    cost_id: UUID
    is_fee: bool
    kind: str
    party: str
    number: str
    document_date: date | None
    incurred_on: date
    amount: Decimal
    plan_line: str
    charges: list[tuple[FundingView, Decimal]]


def charged_documents(money_: ProjectMoney, *, source_id: UUID | None = None) -> list[ChargedDocument]:
    """Every document charged to a source that pays for it: the named source,
    or each source of money but the foundation's own — own funds are the
    absence of a funder, and describe nobody's money on the back of a paper."""
    named = report_funding(money_, source_id)
    fundings = {
        funding.id: funding
        for funding in money_.fundings
        if (funding.id == named.id if named is not None else (
            funding.brings_money and funding.source.source.kind != FundingKind.OWN_FUNDS
        ))
    }
    lines = {line.id: f"{line.number} {line.name}" for line in money_.lines}

    def charges(allocations: list[AllocationView]) -> list[tuple[FundingView, Decimal]]:
        return [(fundings[a.funding_id], a.amount) for a in allocations if a.funding_id in fundings and a.amount > ZERO]

    documents: list[ChargedDocument] = []
    for row in money_.rows:
        found = charges(row.allocations) if row.counted and row.form != FeeForm.VOLUNTEER else []
        if not found or row.cost_item_id is None:
            continue
        contract = row.contract
        billed = contract is not None and contract.form in PAYABLE_CONTRACT_FORMS
        documents.append(ChargedDocument(
            cost_id=row.cost_item_id,
            is_fee=True,
            kind=row.form,
            party=row.payee_name,
            number=contract.number if billed and contract is not None else row.document_number,
            document_date=None if billed else row.document_date,
            incurred_on=row.incurred_on,
            amount=row.contract_amount or ZERO,
            plan_line=lines.get(row.budget_line_id, "") if row.budget_line_id else "",
            charges=found,
        ))
    for expense in money_.expenses:
        found = charges(expense.allocations)
        if not found:
            continue
        documents.append(ChargedDocument(
            cost_id=expense.id,
            is_fee=False,
            kind=expense.document_type,
            party=expense.vendor_name,
            number=expense.document_number,
            document_date=expense.document_date,
            incurred_on=expense.incurred_on,
            amount=expense.cost_amount,
            plan_line=lines.get(expense.budget_line_id, "") if expense.budget_line_id else "",
            charges=found,
        ))
    return sorted(documents, key=lambda document: (document.incurred_on, document.party.casefold()))
