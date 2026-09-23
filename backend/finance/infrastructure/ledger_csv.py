"""
@file ledger_csv.py
@description The office's ledger export: every fee a budget counts, one row
             each, in the shape Polish Excel opens without an import dialog —
             UTF-8 with a BOM, `;` between cells, a decimal comma, dd.mm.yyyy
             dates. The rows are the ledger's own (`counted`), so the export
             sums to the figure the panel states as the cost. The office reads
             Polish, as the contracts do, so the column heads and the
             vocabulary are Polish whatever language the manager uses.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/ledger_csv
"""
import csv
import io
from collections.abc import Iterable
from datetime import date
from decimal import Decimal

from roster.models import Project

from ..models import ContractStatus, CostCategory, FeeForm
from ..services.budget import LedgerRow, ProjectMoney
from .documents import file_segment

HEADER: tuple[str, ...] = (
    "Projekt",
    "Data kosztu",
    "Odbiorca",
    "Rola",
    "Rodzaj kosztu",
    "Forma rozliczenia",
    "Nr umowy lub dokumentu",
    "Stan umowy",
    "Data podpisania",
    "Kwota umowy",
    "Składki pracodawcy",
    "Koszt",
    "Termin płatności",
    "Data zapłaty",
    "NIP",
    "Uwagi",
)

FORM_LABELS: dict[str, str] = {
    FeeForm.DZIELO: "Umowa o dzieło",
    FeeForm.ZLECENIE: "Umowa zlecenia",
    FeeForm.INVOICE: "Faktura",
    FeeForm.VOLUNTEER: "Wolontariat",
    FeeForm.OTHER: "Inna",
}

CATEGORY_LABELS: dict[str, str] = {
    CostCategory.PERSONNEL_ARTISTIC: "Personel artystyczny",
    CostCategory.PERSONNEL_TECHNICAL: "Personel techniczny",
    CostCategory.VENUE: "Miejsce",
    CostCategory.TRAVEL: "Podróże",
    CostCategory.ACCOMMODATION: "Noclegi",
    CostCategory.CATERING: "Wyżywienie",
    CostCategory.MATERIALS: "Materiały i prawa",
    CostCategory.EQUIPMENT: "Sprzęt",
    CostCategory.PROMOTION: "Promocja",
    CostCategory.RECORDING: "Nagranie",
    CostCategory.ADMINISTRATION: "Administracja",
    CostCategory.OTHER: "Inne",
}

# A live contract is issued or signed; an annulled one is never on a row.
CONTRACT_STATUS_LABELS: dict[str, str] = {
    ContractStatus.ISSUED: "Wystawiona",
    ContractStatus.SIGNED: "Podpisana",
}

# Excel reads a cell starting with one of these as a formula. A payee name or a
# note is typed by hand, so text cells that start with one are quoted as text.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _text(value: str) -> str:
    return f"'{value}" if value.startswith(_FORMULA_PREFIXES) else value


def _amount(value: Decimal | None) -> str:
    """Prints 1250.5 as 1250,50: a decimal comma and no digit grouping, which
    Excel would otherwise have to be told how to read."""
    return "" if value is None else f"{value:.2f}".replace(".", ",")


def _date(value: date | None) -> str:
    return "" if value is None else value.strftime("%d.%m.%Y")


def _cells(project: Project, row: LedgerRow) -> list[str]:
    contract = row.contract
    return [
        _text(project.title),
        _date(row.incurred_on),
        _text(row.payee_name),
        _text(row.payee_role),
        CATEGORY_LABELS.get(row.category, row.category),
        FORM_LABELS.get(row.form, row.form),
        _text(contract.number if contract is not None else row.document_number),
        CONTRACT_STATUS_LABELS.get(contract.status, "") if contract is not None else "",
        _date(contract.signed_on) if contract is not None else "",
        _amount(row.contract_amount),
        _amount(row.employer_contributions),
        _amount(row.cost_amount),
        _date(row.due_on),
        _date(row.paid_on),
        row.vendor_nip,
        _text(row.note),
    ]


def ledger_csv(
    moneys: Iterable[ProjectMoney],
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> bytes:
    """Every counted fee of the given budgets whose cost date falls in the
    range (both ends inclusive; an open end is unbounded)."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(HEADER)
    for money in moneys:
        for row in money.rows:
            if not row.counted:
                continue
            if date_from is not None and row.incurred_on < date_from:
                continue
            if date_to is not None and row.incurred_on > date_to:
                continue
            writer.writerow(_cells(money.project, row))
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def project_ledger_filename(project: Project) -> str:
    return f"Rozliczenie-{file_segment(project.title)}.csv"


def range_ledger_filename(date_from: date, date_to: date) -> str:
    return f"Rozliczenia-{date_from.isoformat()}-{date_to.isoformat()}.csv"
