"""
@file reports.py
@description The printed reports of a project's money and the sheet of
             document notes, rendered from what `services/reports.py` decided
             may be said: the patron report (no person and no single fee, a
             draft until the budget is closed), the board report (everything,
             names included), and the notes for the back of every accounting
             document charged to a source, in each source's own formula.

             Polish only and deliberately not gettext'd, like the contracts: a
             patron, the board and a grantor's auditor read these in Polish. Dates
             are rendered under the Polish locale whatever the request's language.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/reports
"""
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from django.template.loader import render_to_string
from django.utils import timezone, translation

from roster.infrastructure.document_generator import _brand_font_context, _render_pdf
from roster.models import Project

from ..foundation import report_foundation_context
from ..models import BudgetStatus, FeeForm, FundingKind
from ..rules import FINANCE_TIMEZONE, PAYABLE_CONTRACT_FORMS, ZERO
from ..services.budget import (
    ORIGIN_CAST,
    ORIGIN_CREW,
    SEVERITY_PROBLEM,
    AllocationView,
    ExpenseRow,
    LedgerRow,
    ProjectMoney,
)
from ..services.reports import (
    CONTRIBUTIONS_DOCUMENT,
    FOUNDATION_OWN,
    FUNDING_MERGED,
    PERSONNEL_MERGED,
    REMAINDER,
    ChargedDocument,
    PatronReport,
    Share,
    charged_documents,
    named_warnings,
    patron_report,
    payables,
    plan_comparison,
    report_funding,
)
from .amount_words import format_amount_pl
from .document_notes import document_notes
from .documents import concert_facts, file_segment
from .vocabulary import (
    BUDGET_OPEN_LABEL,
    BUDGET_STATUS_LABELS,
    CONTRACT_STATUS_LABELS,
    DOCUMENT_TYPE_LABELS,
    FORM_LABELS,
    FORM_SHORT_LABELS,
    FUNDING_KIND_LABELS,
    FUNDING_STATUS_LABELS,
    PATRON_CATEGORY_LABELS,
    PATRON_FOUNDATION_OWN_LABEL,
    PATRON_FUNDING_LABELS,
    PATRON_FUNDING_MERGED_LABEL,
    PATRON_PERSONNEL_MERGED_LABEL,
    PATRON_REMAINDER_LABEL,
    WARNING_TITLES,
)

_PATRON_TEMPLATE = "finance/report_patron.html"
_BOARD_TEMPLATE = "finance/report_board.html"
_NOTES_TEMPLATE = "finance/document_notes.html"

# A signed deviation prints a true minus, not a hyphen. Built from its code
# point so no editor swaps it for the look-alike.
_MINUS = chr(0x2212)

# A board report names at most this many subjects per warning; the rest are a
# count. The panel lists them all, row by row.
_WARNING_SUBJECTS_SHOWN = 12


def _amount(value: Decimal) -> str:
    return format_amount_pl(value)


def _signed(value: Decimal) -> str:
    if value > ZERO:
        return f"+{format_amount_pl(value)}"
    if value < ZERO:
        return f"{_MINUS}{format_amount_pl(-value)}"
    return format_amount_pl(value)


def _pct(value: Decimal) -> str:
    """A share for a reader: whole per cents, and "<1" for a share too small to
    round to one — never a 0 beside an amount that is not."""
    if ZERO < value < 1:
        return "<1"
    return str(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _today() -> date:
    return timezone.localdate(timezone.now(), timezone=FINANCE_TIMEZONE)


def _render(template: str, context: dict[str, Any]) -> str:
    """Renders under the Polish locale: a month written out ("12 października")
    must not come out French because the manager's interface is."""
    with translation.override("pl"):
        return render_to_string(template, context)


def _base_context(money: ProjectMoney, footer_label: str) -> dict[str, Any]:
    return {
        **_brand_font_context(),
        **report_foundation_context(),
        "footer_label": footer_label,
        "project": money.project,
        "concert": concert_facts(money.project),
        "generated_on": _today(),
    }


# --------------------------------------------------------------------------- #
# Patron report                                                                #
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ShareLine:
    label: str
    amount: str
    pct: str
    # The bar's width, as CSS reads a percentage.
    width: str


def _cost_label(key: str) -> str:
    if key == PERSONNEL_MERGED:
        return PATRON_PERSONNEL_MERGED_LABEL
    if key == REMAINDER:
        return PATRON_REMAINDER_LABEL
    return PATRON_CATEGORY_LABELS.get(key, key)


def _funding_label(key: str) -> str:
    if key == FOUNDATION_OWN:
        return PATRON_FOUNDATION_OWN_LABEL
    if key == FUNDING_MERGED:
        return PATRON_FUNDING_MERGED_LABEL
    return PATRON_FUNDING_LABELS.get(key, key)


def _share_lines(shares: list[Share], label: Callable[[str], str]) -> list[ShareLine]:
    return [
        ShareLine(label=label(share.key), amount=_amount(share.amount), pct=_pct(share.pct), width=f"{share.pct}")
        for share in shares
    ]


def _patron_context(report: PatronReport) -> dict[str, Any]:
    money = report.money
    highlight = report.highlight
    return {
        **_base_context(money, "Sprawozdanie dla mecenasa"),
        "is_draft": report.is_draft,
        "summary_text": money.budget.patron_summary.strip() if money.budget is not None else "",
        "total": _amount(report.total),
        "structure": _share_lines(report.structure, _cost_label),
        "funding": _share_lines(report.funding, _funding_label),
        "in_kind": [(_funding_label(share.key), _amount(share.amount)) for share in report.in_kind],
        "highlight": None if highlight is None else {
            "name": highlight.funding.source.source.name,
            "grantor": highlight.funding.source.source.grantor,
            "covered": None if highlight.covered is None else _amount(highlight.covered),
            "structure": _share_lines(highlight.structure, _cost_label),
        },
    }


def render_patron_report_html(money: ProjectMoney, *, source_id: UUID | None = None) -> str:
    return _render(_PATRON_TEMPLATE, _patron_context(patron_report(money, source_id=source_id)))


# --------------------------------------------------------------------------- #
# Board report                                                                 #
# --------------------------------------------------------------------------- #


def _sources_text(allocations: list[AllocationView], names: dict[UUID, str]) -> str:
    return "; ".join(f"{names.get(a.funding_id, '')}: {_amount(a.amount)}" for a in allocations if a.amount > ZERO)


def _fee_line(row: LedgerRow, names: dict[UUID, str]) -> dict[str, str]:
    contract = row.contract
    amount, amount_note = _amount(row.contract_amount or ZERO), ""
    if not row.is_priced:
        amount, amount_note = "", "bez stawki"
    elif row.form == FeeForm.VOLUNTEER:
        amount = _amount(row.in_kind_value) if row.in_kind_value is not None else ""
        amount_note = "wycena pracy"
    state = ""
    if row.is_declined:
        state = "odmowa udziału"
    elif row.orphaned:
        state = "poza obsadą, nie wlicza się"
    return {
        "name": row.payee_name,
        "role": row.payee_role,
        "state": state,
        "form": FORM_SHORT_LABELS.get(row.form, row.form),
        "amount": amount,
        "amount_note": amount_note,
        "cost": _amount(row.cost_amount) if row.counted and row.cost_amount is not None else "",
        "document": contract.number if contract is not None else row.document_number,
        "document_note": CONTRACT_STATUS_LABELS.get(contract.status, "").lower() if contract is not None else "",
        "paid": row.paid_on.strftime("%d.%m.%Y") if row.paid_on else "",
        "sources": _sources_text(row.allocations, names),
    }


def _expense_line(expense: ExpenseRow, names: dict[UUID, str], lines: dict[UUID, str]) -> dict[str, str]:
    kind = DOCUMENT_TYPE_LABELS.get(expense.document_type, expense.document_type)
    return {
        "date": expense.incurred_on.strftime("%d.%m.%Y"),
        "vendor": expense.vendor_name,
        "description": expense.description,
        "document": f"{kind} {expense.document_number}".strip(),
        "amount": _amount(expense.cost_amount),
        "paid": expense.paid_on.strftime("%d.%m.%Y") if expense.paid_on else "",
        "line": lines.get(expense.budget_line_id, "") if expense.budget_line_id else "",
        "sources": _sources_text(expense.allocations, names),
    }


_FEE_GROUPS = ((ORIGIN_CAST, "Obsada"), (ORIGIN_CREW, "Ekipa"))
_ONE_OFF_GROUP = "Spoza obsady"


def _board_context(money: ProjectMoney) -> dict[str, Any]:
    summary = money.summary
    funding = money.funding
    names = {f.id: f.source.source.name for f in money.fundings}
    lines = {line.id: f"{line.number} {line.name}" for line in money.lines}

    figures: list[tuple[str, str]] = []
    if summary.planned is not None:
        figures.append(("Plan", _amount(summary.planned)))
    figures += [
        ("Koszt projektu", _amount(summary.committed)),
        ("Zapłacone", _amount(summary.paid)),
        ("Do zapłaty", _amount(summary.outstanding)),
    ]
    if money.fundings:
        # The foundation's own is what the patron report calls it: its own
        # funds charged, plus whatever no source carries.
        own_funds = sum(
            (f.charged for f in money.fundings if f.source.source.kind == FundingKind.OWN_FUNDS), ZERO,
        )
        figures += [
            ("Pokryte ze źródeł zewnętrznych", _amount(funding.charged - own_funds)),
            (PATRON_FOUNDATION_OWN_LABEL, _amount(funding.uncovered + own_funds)),
        ]
    if funding.in_kind_contributed > ZERO:
        figures.append(("Wkład niefinansowy", _amount(funding.in_kind_contributed)))

    comparison = [
        {
            "number": item.line.number if item.line else "",
            "name": item.line.name if item.line else "Poza kosztorysem",
            "planned": _amount(item.planned) if item.planned is not None else "",
            "actual": _amount(item.actual),
            "deviation": _signed(item.deviation) if item.deviation is not None else "",
            "pct": _pct_signed(item.deviation_pct),
            "note": _line_note(item.line.over_plan, item.line.over_tolerance, item.line.tolerance_pct)
            if item.line else "",
        }
        for item in plan_comparison(money)
    ]

    fee_groups: list[tuple[str, list[dict[str, str]]]] = []
    for origin, title in _FEE_GROUPS:
        group = [_fee_line(row, names) for row in money.rows if row.origin == origin]
        if group:
            fee_groups.append((title, group))
    one_off = [
        _fee_line(row, names) for row in money.rows if row.origin not in (ORIGIN_CAST, ORIGIN_CREW)
    ]
    if one_off:
        fee_groups.append((_ONE_OFF_GROUP, one_off))

    warnings = []
    for named in named_warnings(money):
        shown = named.subjects[:_WARNING_SUBJECTS_SHOWN]
        hidden = len(named.subjects) - len(shown)
        warnings.append({
            "problem": named.warning.severity == SEVERITY_PROBLEM,
            "title": WARNING_TITLES.get(named.warning.code, named.warning.code),
            "subjects": ", ".join(shown) + (f" i jeszcze {hidden}" if hidden else ""),
        })

    owed = payables(money)
    return {
        **_base_context(money, "Raport dla zarządu"),
        "status": (
            BUDGET_OPEN_LABEL
            if money.budget_status == BudgetStatus.PLANNING and not money.has_plan
            else BUDGET_STATUS_LABELS.get(money.budget_status, money.budget_status)
        ),
        "figures": figures,
        "comparison": comparison,
        "has_plan": money.has_plan,
        "plan_total": _amount(summary.planned) if summary.planned is not None else "",
        "actual_total": _amount(summary.committed),
        "fundings": [
            {
                "name": f.source.source.name,
                "kind": FUNDING_KIND_LABELS.get(f.source.source.kind, f.source.source.kind),
                "status": FUNDING_STATUS_LABELS.get(f.source.source.status, f.source.source.status),
                "planned": _amount(f.planned_amount),
                "received": _amount(f.received_amount),
                "line_allocated": _amount(f.line_allocated),
                "charged": _amount(f.charged),
                "in_kind": not f.brings_money,
            }
            for f in money.fundings
        ],
        "warnings": warnings,
        "payables": [
            {
                "name": p.name,
                "kind": "honorarium" if p.is_fee else "wydatek",
                "due": p.due_on.strftime("%d.%m.%Y") if p.due_on else "",
                "amount": _amount(p.amount),
            }
            for p in owed
        ],
        "payables_total": _amount(sum((p.amount for p in owed), ZERO)),
        "fee_groups": fee_groups,
        "expenses": [_expense_line(expense, names, lines) for expense in money.expenses],
        "expenses_total": _amount(summary.expenses.committed),
    }


def _pct_signed(value: Decimal | None) -> str:
    if value is None:
        return ""
    rounded = value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if rounded > 0:
        return f"+{rounded}%"
    if rounded < 0:
        return f"{_MINUS}{-rounded}%"
    return "0%"


def _line_note(over_plan: bool, over_tolerance: bool, tolerance_pct: Decimal) -> str:
    """A line over its plan says whether its sources tolerate it — the one fact
    a grant settlement turns on."""
    if over_tolerance:
        return "ponad tolerancję"
    if over_plan and tolerance_pct > ZERO:
        return f"w tolerancji {tolerance_pct.normalize():f}%"
    return ""


def render_board_report_html(money: ProjectMoney) -> str:
    return _render(_BOARD_TEMPLATE, _board_context(money))


# --------------------------------------------------------------------------- #
# Document notes                                                               #
# --------------------------------------------------------------------------- #


def _document_heading(document: ChargedDocument) -> str:
    if document.kind == CONTRIBUTIONS_DOCUMENT:
        heading = "Składki ZUS płatnika"
        return f"{heading} do umowy nr {document.refers_to}" if document.refers_to else heading
    if document.is_fee:
        if document.kind in PAYABLE_CONTRACT_FORMS:
            kind = "Rachunek do umowy"
        else:
            kind = FORM_LABELS.get(document.kind, document.kind)
    else:
        kind = DOCUMENT_TYPE_LABELS.get(document.kind, document.kind)
    return f"{kind} nr {document.number}" if document.number else kind


def _notes_context(money: ProjectMoney, source_id: UUID | None) -> dict[str, Any]:
    named = report_funding(money, source_id)
    documents = charged_documents(money, source_id=source_id)
    return {
        **_base_context(money, "Opisy dokumentów"),
        "source": named.source.source if named is not None else None,
        "documents": [
            {
                "heading": _document_heading(document),
                "party": document.party,
                "date": document.document_date,
                "amount": _amount(document.amount),
                "notes": document_notes(document),
            }
            for document in documents
        ],
        "own_funds_excluded": named is None and any(
            f.source.source.kind == FundingKind.OWN_FUNDS and f.charged > ZERO for f in money.fundings
        ),
    }


def render_document_notes_html(money: ProjectMoney, *, source_id: UUID | None = None) -> str:
    return _render(_NOTES_TEMPLATE, _notes_context(money, source_id))


# --------------------------------------------------------------------------- #
# PDFs and filenames                                                           #
# --------------------------------------------------------------------------- #


def render_patron_report_pdf(money: ProjectMoney, *, source_id: UUID | None = None) -> bytes:
    return _render_pdf(render_patron_report_html(money, source_id=source_id))


def render_board_report_pdf(money: ProjectMoney) -> bytes:
    return _render_pdf(render_board_report_html(money))


def render_document_notes_pdf(money: ProjectMoney, *, source_id: UUID | None = None) -> bytes:
    return _render_pdf(render_document_notes_html(money, source_id=source_id))


def patron_report_filename(project: Project) -> str:
    return f"Sprawozdanie-dla-mecenasa-{file_segment(project.title)}.pdf"


def board_report_filename(project: Project) -> str:
    return f"Raport-dla-zarzadu-{file_segment(project.title)}.pdf"


def document_notes_filename(project: Project) -> str:
    return f"Opisy-dokumentow-{file_segment(project.title)}.pdf"
