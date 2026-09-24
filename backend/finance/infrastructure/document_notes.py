"""
@file document_notes.py
@description The note for the back of an accounting document charged to a
             source, in that source's own formula: what the sheet of document
             notes prints for every document, and what a bill prints on its
             "Źródło finansowania" line for its own cost. Polish only, like the
             documents it is written on.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/document_notes
"""
from decimal import Decimal
from string import Formatter
from uuid import UUID

from django.utils.html import escape
from django.utils.safestring import SafeString, mark_safe

from ..services.budget import FundingView, ProjectMoney
from ..services.reports import CONTRIBUTIONS_DOCUMENT, ChargedDocument, charged_documents
from .amount_words import format_amount_pl

_BLANK = '<span class="blank"></span>'


def render_note(template: str, values: dict[str, str]) -> SafeString:
    """The source's formula with its placeholders filled. A value the panel
    does not know (an agreement not yet signed, a cost on no kosztorys line)
    prints as a dotted line to fill in by hand, never as an empty gap the
    reader would not notice. Everything typed is escaped; the placeholders
    were checked when the formula was saved."""
    parts: list[str] = []
    for literal, name, _spec, _conversion in Formatter().parse(template):
        parts.append(escape(literal))
        if name is not None:
            value = values.get(name, "").strip()
            parts.append(escape(value) if value else _BLANK)
    return mark_safe("".join(parts))


def note_values(document: ChargedDocument, amount: Decimal, funding: FundingView) -> dict[str, str]:
    source = funding.source.source
    return {
        "document_number": document.number,
        "document_amount": format_amount_pl(document.amount),
        "source_amount": format_amount_pl(amount),
        "source_name": source.name,
        "grantor": source.grantor,
        "agreement_number": source.agreement_number,
        "agreement_date": source.agreement_date.strftime("%d.%m.%Y") if source.agreement_date else "",
        "plan_line": document.plan_line,
    }


def document_notes(document: ChargedDocument) -> list[SafeString]:
    """One note per source the document is charged to."""
    return [
        render_note(funding.source.source.document_note_template, note_values(document, amount, funding))
        for funding, amount in document.charges
    ]


def bill_notes(money: ProjectMoney, cost_id: UUID) -> list[SafeString]:
    """What a fee's bill says of the sources paying it: the notes of the bill
    itself, never of the employer contributions, which are declared apart. Empty
    when no source that pays is charged — the line is then filled by hand."""
    return [
        note
        for document in charged_documents(money)
        if document.cost_id == cost_id and document.kind != CONTRIBUTIONS_DOCUMENT
        for note in document_notes(document)
    ]
