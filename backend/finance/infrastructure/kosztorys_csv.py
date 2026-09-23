"""
@file kosztorys_csv.py
@description The kosztorys in the public-benefit layout, planned or actual, as
             the sheet a grant generator (Witkac, eNGO) is typed from: Lp. ·
             Rodzaj kosztu · Liczba jednostek · Koszt jednostkowy · Rodzaj miary
             · Wartość · z dotacji · z innych środków finansowych · z wkładu
             osobowego · z wkładu rzeczowego, by section, with each section's
             and the whole's totals. A last column states what no source
             carries yet, rather than folding it into one of the four.

             The actual variant has no quantity or unit cost: the ledger records
             what a line cost, not how many units it bought, and the export does
             not invent them. Which grant "z dotacji" reads is `?source=`, or
             every public grant on the project. The column set is the generic
             one until the first grantor's form is known (spec Q1).
@architecture Enterprise SaaS 2026
@module finance/infrastructure/kosztorys_csv
"""
from decimal import Decimal
from uuid import UUID

from roster.models import Project

from ..rules import PLAN_SECTION_ACTIVITIES, PLAN_SECTION_ADMINISTRATION, ZERO, money
from ..services.budget import ProjectMoney
from ..services.reports import (
    COLUMN_GRANT,
    COLUMN_MATERIAL,
    COLUMN_OTHER_MONEY,
    COLUMN_PERSONAL,
    COLUMN_UNASSIGNED,
    VARIANT_PLAN,
    KosztorysRow,
    KosztorysSection,
    kosztorys,
)
from .csv_format import amount_cell, encode_csv, text_cell
from .documents import file_segment
from .vocabulary import UNIT_LABELS

HEADER: tuple[str, ...] = (
    "Lp.",
    "Rodzaj kosztu",
    "Liczba jednostek",
    "Koszt jednostkowy",
    "Rodzaj miary",
    "Wartość",
    "z dotacji",
    "z innych środków finansowych",
    "z wkładu osobowego",
    "z wkładu rzeczowego",
    "nieprzypisane do źródła",
)

_COLUMNS = (COLUMN_GRANT, COLUMN_OTHER_MONEY, COLUMN_PERSONAL, COLUMN_MATERIAL, COLUMN_UNASSIGNED)

SECTION_NAMES: dict[str, str] = {
    PLAN_SECTION_ACTIVITIES: "Koszty realizacji działań",
    PLAN_SECTION_ADMINISTRATION: "Koszty administracyjne",
}

_UNPLANNED_NAME = "Koszty poza kosztorysem"


def _quantity(value: Decimal) -> str:
    """12 as "12", 2.5 as "2,5": a count, not an amount of money."""
    text = f"{value.normalize():f}"
    return text.replace(".", ",")


def _figures(value: Decimal, split: dict[str, Decimal]) -> list[str]:
    return [amount_cell(value), *(amount_cell(split[column]) for column in _COLUMNS)]


def _line_cells(row: KosztorysRow, *, variant: str) -> list[str]:
    line = row.line
    if line is None:
        return ["", _UNPLANNED_NAME, "", "", "", *_figures(row.value, row.split)]
    planned = variant == VARIANT_PLAN
    return [
        line.number,
        text_cell(line.name),
        _quantity(line.quantity) if planned else "",
        amount_cell(line.unit_cost) if planned else "",
        UNIT_LABELS.get(line.unit, line.unit),
        *_figures(row.value, row.split),
    ]


def _section_total(section: KosztorysSection) -> dict[str, Decimal]:
    return {column: section.total(column) for column in _COLUMNS}


def kosztorys_csv(money_: ProjectMoney, *, variant: str, source_id: UUID | None = None) -> bytes:
    sections = kosztorys(money_, variant=variant, source_id=source_id)
    rows: list[list[str]] = [list(HEADER)]
    grand = {column: ZERO for column in _COLUMNS}
    for section in sections:
        name = SECTION_NAMES.get(section.section, section.section)
        rows.append([section.section, name, "", "", "", "", "", "", "", "", ""])
        rows.extend(_line_cells(row, variant=variant) for row in section.rows)
        totals = _section_total(section)
        rows.append(["", f"Razem: {name.lower()}", "", "", "", *_figures(section.value, totals)])
        for column in _COLUMNS:
            grand[column] += totals[column]
    grand_value = money(sum((section.value for section in sections), ZERO))
    rows.append(["", "Ogółem", "", "", "", *_figures(grand_value, grand)])
    return encode_csv(rows)


def kosztorys_filename(project: Project, *, variant: str) -> str:
    label = "plan" if variant == VARIANT_PLAN else "wykonanie"
    return f"Kosztorys-{label}-{file_segment(project.title)}.csv"
