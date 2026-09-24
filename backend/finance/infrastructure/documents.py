"""
@file documents.py
@description The foundation's own documents for a fee, rendered from the
             contract row: the umowa o dzieło, the umowa zlecenia and the
             porozumienie wolontariackie, each with its annexes, and the bill.
             The paper prints the row's number, frozen amount and payee — never
             the item's live figures, which may have moved since issuance.

             Polish only and deliberately not gettext'd: this is Polish legal
             text under Polish law, settled with the foundation's lawyer rather
             than a translator, and a word resolved through the request's
             language would drop French into a Polish contract. The wording's
             source is `docs/specs/project-finance-contract-drafts-2026-09.md`;
             a correction lands there first, then in the template.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/documents
"""
from dataclasses import dataclass
from datetime import date
from typing import Any

from django.db.models import Min
from django.template.loader import render_to_string
from django.utils import timezone

from roster.infrastructure.document_generator import DocumentGenerator, _brand_font_context, _render_pdf
from roster.models import SINGING_VOICE_TYPES, Collaborator, ProgramItem, Project, Rehearsal, VoiceType

from ..exceptions import BillNotApplicable, ContractAnnulled
from ..foundation import foundation_context
from ..models import Contract, ContractStatus, CostItem, FeeForm
from ..rules import FINANCE_TIMEZONE, PAYABLE_CONTRACT_FORMS, VOLUNTEER_INSURANCE_MAX_DAYS, local_date
from ..services.budget import BudgetService, volunteer_period_days
from .amount_words import amount_to_words_pl, format_amount_pl
from .document_notes import bill_notes

_CONTRACT_TEMPLATES: dict[str, str] = {
    FeeForm.DZIELO: "finance/contract_dzielo.html",
    FeeForm.ZLECENIE: "finance/contract_zlecenie.html",
    FeeForm.VOLUNTEER: "finance/agreement_volunteer.html",
}
_BILL_TEMPLATE = "finance/bill.html"

# What the person performs, which decides how the subject clause reads.
SUBJECT_VOCAL = "vocal"
SUBJECT_INSTRUMENTAL = "instrumental"
SUBJECT_ROLE = "role"


@dataclass(frozen=True)
class Subject:
    """`role` is the item's payee-role snapshot, frozen at issuance: the voice,
    the instrument, or the role a crew member or a one-off payee was engaged
    for. Printed in the nominative after a colon, so no case has to agree."""

    kind: str
    role: str


@dataclass(frozen=True)
class Concert:
    title: str
    day: date
    # Venue name and address, or "" when the project has no venue yet — the
    # paper then carries a line to write it in.
    place: str


@dataclass(frozen=True)
class ProgrammeEntry:
    composer: str
    title: str
    is_encore: bool


@dataclass(frozen=True)
class VolunteerTerms:
    period_from: date
    period_to: date
    # Art. 46 of the Volunteer Act: an engagement of up to 30 days obliges the
    # foundation to insure the volunteer, and the agreement says so.
    insured: bool
    # The valuation of an hour for the in-kind contribution, or "" to fill by hand.
    hourly_rate: str


def _subject(item: CostItem) -> Subject:
    role = item.payee_role.strip()
    seat = item.participation
    if seat is not None:
        if seat.artist.voice_type in SINGING_VOICE_TYPES:
            return Subject(SUBJECT_VOCAL, role)
        if seat.artist.voice_type == VoiceType.INSTRUMENTALIST:
            return Subject(SUBJECT_INSTRUMENTAL, role)
    elif (
        item.crew_assignment is not None
        and item.crew_assignment.collaborator.specialty == Collaborator.Specialty.INSTRUMENT
    ):
        return Subject(SUBJECT_INSTRUMENTAL, role)
    return Subject(SUBJECT_ROLE, role)


def _payee_email(item: CostItem) -> str | None:
    """The payee's account email, the stronger of the two ways a board member is
    recognised as the payee. Only a cast member can hold an account."""
    seat = item.participation
    if seat is not None and seat.artist.user is not None:
        return seat.artist.user.email
    return None


def _place(project: Project) -> str:
    venue = project.location
    if venue is None:
        return ""
    parts = [venue.name.strip(), *DocumentGenerator._format_address(venue.formatted_address).split(", ")]
    seen: set[str] = set()
    kept: list[str] = []
    for part in parts:
        key = part.casefold()
        if part and key not in seen:
            seen.add(key)
            kept.append(part)
    return ", ".join(kept)


def concert_facts(project: Project) -> Concert:
    return Concert(
        title=project.title,
        day=local_date(project.date_time, project.timezone),
        place=_place(project),
    )


def programme(project: Project) -> list[ProgrammeEntry]:
    """Annex 1 of the umowa o dzieło: the works the performance consists of, in
    concert order. It is what individualises the work contracted for."""
    items = ProgramItem.objects.filter(project=project).select_related("piece__composer").order_by("order")
    return [
        ProgrammeEntry(
            composer=str(item.piece.composer) if item.piece.composer is not None else "",
            title=item.piece.title,
            is_encore=item.is_encore,
        )
        for item in items
    ]


def _volunteer_terms(item: CostItem, project: Project, concert_day: date) -> VolunteerTerms:
    first_rehearsal = Rehearsal.objects.filter(project=project).aggregate(first=Min("date_time"))["first"]
    period_from = concert_day
    if first_rehearsal is not None:
        period_from = min(local_date(first_rehearsal, project.timezone), concert_day)
    rate = item.in_kind_hourly_rate
    return VolunteerTerms(
        period_from=period_from,
        period_to=concert_day,
        insured=volunteer_period_days(first_rehearsal, project, concert_day) <= VOLUNTEER_INSURANCE_MAX_DAYS,
        hourly_rate=format_amount_pl(rate) if rate is not None else "",
    )


def _load(contract: Contract) -> Contract:
    """The contract with everything its documents print, in one query."""
    return Contract.objects.select_related(
        "cost_item__budget__project__location",
        "cost_item__participation__artist__user",
        "cost_item__crew_assignment__collaborator",
    ).get(pk=contract.pk)


def _assert_printable(contract: Contract) -> None:
    """An annulled contract stays as the record of a spent number; printing it
    again would put a void document back into circulation."""
    if contract.status == ContractStatus.ANNULLED:
        raise ContractAnnulled()


def _document_context(contract: Contract) -> dict[str, Any]:
    """What every document of a contract prints: the parties, the number, the
    frozen amount in figures and words, the subject and the concert."""
    item = contract.cost_item
    return {
        **_brand_font_context(),
        **foundation_context(payee_name=contract.payee_name, payee_email=_payee_email(item)),
        "number": contract.number,
        "form": contract.form,
        "payee_name": contract.payee_name,
        "issued_on": timezone.localtime(contract.issued_at, FINANCE_TIMEZONE).date(),
        # Known once the signed paper is recorded; the bill then names the
        # contract's date instead of leaving it to the pen.
        "signed_on": contract.signed_on,
        "amount": format_amount_pl(contract.amount),
        "amount_words": amount_to_words_pl(contract.amount),
        "subject": _subject(item),
        "concert": concert_facts(item.budget.project),
    }


def render_contract_html(contract: Contract) -> str:
    """The contract with its annexes, as the HTML the PDF engine receives."""
    contract = _load(contract)
    _assert_printable(contract)
    context = _document_context(contract)
    project = contract.cost_item.budget.project
    if contract.form == FeeForm.DZIELO:
        context["programme"] = programme(project)
    if contract.form == FeeForm.VOLUNTEER:
        context["volunteer"] = _volunteer_terms(contract.cost_item, project, context["concert"].day)
    return render_to_string(_CONTRACT_TEMPLATES[contract.form], context)


def render_bill_html(contract: Contract) -> str:
    """The bill the payee signs to be paid against the contract. The tax rows
    are the office's to fill: the panel never computes PIT or ZUS. The source
    line carries the note of every source the fee is charged to when the bill
    is printed; without one it stays a line to fill by hand."""
    contract = _load(contract)
    _assert_printable(contract)
    if contract.form not in PAYABLE_CONTRACT_FORMS:
        raise BillNotApplicable()
    context = _document_context(contract)
    context["source_notes"] = bill_notes(BudgetService.build(contract.cost_item.budget.project), contract.cost_item_id)
    return render_to_string(_BILL_TEMPLATE, context)


def render_contract_pdf(contract: Contract) -> bytes:
    return _render_pdf(render_contract_html(contract))


def render_bill_pdf(contract: Contract) -> bytes:
    return _render_pdf(render_bill_html(contract))


def file_segment(value: str) -> str:
    """A filename fragment: no spaces and no path separators. A contract number
    carries slashes ("UoD/3/2026")."""
    return value.strip().replace(" ", "_").replace("/", "-").replace("\\", "-")


def contract_filename(contract: Contract) -> str:
    return f"Umowa-{file_segment(contract.number)}-{file_segment(contract.payee_name)}.pdf"


def bill_filename(contract: Contract) -> str:
    return f"Rachunek-{file_segment(contract.number)}-{file_segment(contract.payee_name)}.pdf"


def contracts_zip_filename(project: Project) -> str:
    return f"Umowy-{file_segment(project.title)}.zip"
