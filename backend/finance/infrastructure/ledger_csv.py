"""
@file ledger_csv.py
@description The office's ledger export: every fee a budget counts and every
             expense, one row each — the payee or vendor, the form, the
             contract's or the document's number and dates, the amounts, the
             payment, the kosztorys line and the sources the cost is charged
             to. The rows are the budget's own (a fee only when `counted`), so
             the export sums to the figure the panel states as the cost. The
             office reads Polish, as the contracts do, so the column heads and
             the vocabulary are Polish whatever language the manager uses.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/ledger_csv
"""
from collections.abc import Iterable
from datetime import date
from uuid import UUID

from roster.models import Project

from ..services.budget import AllocationView, ExpenseRow, LedgerRow, ProjectMoney
from .csv_format import amount_cell, code_cell, date_cell, encode_csv, text_cell
from .documents import file_segment
from .vocabulary import CATEGORY_LABELS, CONTRACT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, FORM_LABELS

HEADER: tuple[str, ...] = (
    "Projekt",
    "Data kosztu",
    "Odbiorca",
    "Rola",
    "Rodzaj kosztu",
    "Forma rozliczenia",
    "Nr umowy lub dokumentu",
    "Data dokumentu",
    "Stan umowy",
    "Data podpisania",
    "Kwota umowy",
    "Składki pracodawcy",
    "Koszt",
    "Termin płatności",
    "Data zapłaty",
    "NIP",
    "Uwagi",
    "Pozycja kosztorysu",
    "Źródła finansowania",
    "Kwota ze źródeł",
)

# Between two sources in one cell. Neither `;` (the cell separator) nor `,`
# (the decimal comma inside each amount).
_SOURCE_SEPARATOR = " / "


def _sources_cells(allocations: list[AllocationView], names: dict[UUID, str], allocated: str) -> list[str]:
    """Each source the cost is charged to with its share ("Dotacja MKiDN:
    1250,00 / Bilety: 200,00"), and the sum. A volunteer's valuation is listed
    too: it is charged to the volunteer-work source, not paid."""
    listed = _SOURCE_SEPARATOR.join(
        f"{names.get(allocation.funding_id, '')}: {amount_cell(allocation.amount)}" for allocation in allocations
    )
    return [text_cell(listed), allocated if allocations else ""]


def _fee_cells(project: Project, row: LedgerRow, line: str, names: dict[UUID, str]) -> list[str]:
    contract = row.contract
    return [
        text_cell(project.title),
        date_cell(row.incurred_on),
        text_cell(row.payee_name),
        text_cell(row.payee_role),
        CATEGORY_LABELS.get(row.category, row.category),
        FORM_LABELS.get(row.form, row.form),
        code_cell(contract.number if contract is not None else row.document_number),
        date_cell(row.document_date) if contract is None else "",
        CONTRACT_STATUS_LABELS.get(contract.status, "") if contract is not None else "",
        date_cell(contract.signed_on) if contract is not None else "",
        amount_cell(row.contract_amount),
        amount_cell(row.employer_contributions),
        amount_cell(row.cost_amount),
        date_cell(row.due_on),
        date_cell(row.paid_on),
        row.vendor_nip,
        text_cell(row.note),
        text_cell(line),
        *_sources_cells(row.allocations, names, amount_cell(row.allocated)),
    ]


def _expense_cells(project: Project, expense: ExpenseRow, line: str, names: dict[UUID, str]) -> list[str]:
    return [
        text_cell(project.title),
        date_cell(expense.incurred_on),
        text_cell(expense.vendor_name),
        text_cell(expense.description),
        CATEGORY_LABELS.get(expense.category, expense.category),
        DOCUMENT_TYPE_LABELS.get(expense.document_type, expense.document_type),
        code_cell(expense.document_number),
        date_cell(expense.document_date),
        "",
        "",
        "",
        "",
        amount_cell(expense.cost_amount),
        date_cell(expense.due_on),
        date_cell(expense.paid_on),
        expense.vendor_nip,
        text_cell(expense.note),
        text_cell(line),
        *_sources_cells(expense.allocations, names, amount_cell(expense.allocated)),
    ]


def _in_range(day: date, date_from: date | None, date_to: date | None) -> bool:
    return (date_from is None or day >= date_from) and (date_to is None or day <= date_to)


def ledger_csv(
    moneys: Iterable[ProjectMoney],
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> bytes:
    """Every counted fee and every expense of the given budgets whose cost date
    falls in the range (both ends inclusive; an open end is unbounded). The
    plan line is written as the kosztorys prints it: "I.2 Wynajem kościoła"."""
    rows: list[list[str]] = [list(HEADER)]
    for money in moneys:
        lines: dict[UUID, str] = {line.id: f"{line.number} {line.name}" for line in money.lines}
        names = {funding.id: funding.source.source.name for funding in money.fundings}
        for row in money.rows:
            if row.counted and _in_range(row.incurred_on, date_from, date_to):
                line = lines.get(row.budget_line_id, "") if row.budget_line_id else ""
                rows.append(_fee_cells(money.project, row, line, names))
        for expense in money.expenses:
            if _in_range(expense.incurred_on, date_from, date_to):
                line = lines.get(expense.budget_line_id, "") if expense.budget_line_id else ""
                rows.append(_expense_cells(money.project, expense, line, names))
    return encode_csv(rows)


def project_ledger_filename(project: Project) -> str:
    return f"Rozliczenie-{file_segment(project.title)}.csv"


def range_ledger_filename(date_from: date, date_to: date) -> str:
    return f"Rozliczenia-{date_from.isoformat()}-{date_to.isoformat()}.csv"
