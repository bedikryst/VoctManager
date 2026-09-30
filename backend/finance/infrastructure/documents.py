"""
@file documents.py
@description The foundation's own documents for a fee, rendered from the
             contract row: the umowa o dzieło, the umowa zlecenia and the
             porozumienie wolontariackie, each with its annexes, and the bill.
             The paper prints the row's number, frozen amount and payee — never
             the item's live figures, which may have moved since issuance.
             What it reads live is the concert: the programme, a cast
             performer's parts in it, and for an umowa zlecenia the rehearsal
             days the hours record lists. That holds until the signature is
             recorded; from then the contract prints the snapshot taken at that
             moment, so the paper and its reprint cannot drift apart.

             Polish only and deliberately not gettext'd: this is Polish legal
             text under Polish law, intended for legal review rather
             than translation, and a word resolved through the request's
             language would drop French into a Polish contract. The wording's
             source is `docs/specs/project-finance-contract-drafts-2026-09.md`;
             a correction lands there first, then in the template.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/documents
"""
import calendar
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from itertools import groupby
from typing import Any
from uuid import UUID

from django.db.models import Min
from django.template.loader import render_to_string
from django.utils import timezone, translation
from django.utils.safestring import mark_safe

from archive.models import PieceVoiceRequirement
from archive.services.voice_scope import voice_scope
from core.constants import VoiceLine
from core.voice_labels import voice_line_label
from roster.infrastructure.document_generator import DocumentGenerator, _brand_font_context, _render_pdf
from roster.models import (
    SINGING_VOICE_TYPES,
    Attendance,
    Collaborator,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    ProjectSoloAssignment,
    Rehearsal,
    VoiceType,
)
from roster.score_package_config import resolve_item_edition

from ..exceptions import BillNotApplicable, ContractAnnulled, ContractRefused
from ..foundation import foundation_context
from ..models import Contract, ContractSnapshot, ContractStatus, CostItem, FeeForm
from ..rules import (
    FINANCE_TIMEZONE,
    PAYABLE_CONTRACT_FORMS,
    VOLUNTEER_INSURANCE_MAX_DAYS,
    is_artistic_payee,
    local_date,
)
from ..services.budget import BudgetService, volunteer_period_days
from .amount_words import amount_to_words_pl, format_amount_pl
from .document_notes import bill_notes
from .vocabulary import MONTH_NAMES

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
class Solo:
    label: str
    # Where the solo sits in the score ("t. 46-52"), or "".
    score_reference: str


@dataclass(frozen=True)
class PerformerPart:
    """One row of a performer's "Partie" annex: a programme work and what this
    person performs in it. `line` is the Polish name of their voice line, or ""
    when they hold only a solo there or have no casting yet."""

    composer: str
    title: str
    is_encore: bool
    line: str
    solos: tuple[Solo, ...]


@dataclass(frozen=True)
class Period:
    # None when the app knows none of the person's days: a line for the pen.
    start: date | None
    end: date


@dataclass(frozen=True)
class HoursRow:
    day: date
    # Exact hours and minutes ("2:45"), or "" for the pen.
    hours: str


@dataclass(frozen=True)
class HoursSheet:
    """One month of an umowa zlecenia's hours record."""

    month: str
    year: int
    rows: tuple[HoursRow, ...]
    # Printed only when every row carries its hours: a sum over a blank row
    # would be a wrong figure on a signed page.
    total: str
    # Every day of the month, as the office's own form lists them, for a
    # contractor the app knows no working days of.
    full_month: bool


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
    """The programme annex for a conductor or an instrumental performer
    outside the cast, in concert order."""
    items = ProgramItem.objects.filter(project=project).select_related("piece__composer").order_by("order")
    return [
        ProgrammeEntry(
            composer=str(item.piece.composer) if item.piece.composer is not None else "",
            title=item.piece.title,
            is_encore=item.is_encore,
        )
        for item in items
    ]


def _is_performer(item: CostItem, subject: Subject) -> bool:
    """A cast singer or player, whose contract names their parts. A conductor
    is cast too but holds no part in a piece, so receives the programme annex."""
    return item.participation is not None and subject.kind in (SUBJECT_VOCAL, SUBJECT_INSTRUMENTAL)


_LINE_ORDER = {code: index for index, code in enumerate(VoiceLine.values)}


def _line_label(code: str, piece_lines: set[str]) -> str:
    """Canonical contextual labels, in the contract's language regardless of the UI."""
    with translation.override("pl"):
        return voice_line_label(code, piece_lines)


def _one_line(text: str) -> str:
    return " ".join(text.split())


def performer_parts(project: Project, seat: Participation) -> list[PerformerPart]:
    """Annex 1 of a cast performer's contract: the programme works in concert
    order, each with the voice line and the named solos this person holds in
    it — the result a work contract has to fix per person. A work they neither
    sing nor play in is left out. Somebody with no casting at all yet gets the
    whole programme with the part cells blank, to be written in by hand."""
    items = list(
        ProgramItem.objects.filter(project=project).select_related("piece__composer")
        .prefetch_related("piece__editions").order_by("order")
    )
    piece_ids = {item.piece_id for item in items}
    requirements: dict[UUID, list[PieceVoiceRequirement]] = defaultdict(list)
    for requirement in PieceVoiceRequirement.objects.filter(piece_id__in=piece_ids):
        requirements[requirement.piece_id].append(requirement)

    lines_in_piece: dict[UUID, set[str]] = defaultdict(set)
    own_lines: dict[UUID, set[str]] = defaultdict(set)
    castings = ProjectPieceCasting.objects.filter(
        participation__project=project, participation__is_deleted=False, piece_id__in=piece_ids,
    ).values_list("piece_id", "participation_id", "voice_line")
    for piece_id, seat_id, code in castings:
        lines_in_piece[piece_id].add(code)
        if seat_id == seat.pk:
            own_lines[piece_id].add(code)

    solos: dict[UUID, list[Solo]] = defaultdict(list)
    assigned = ProjectSoloAssignment.objects.filter(
        project=project, participation=seat, participation__is_deleted=False, piece_id__in=piece_ids,
    ).order_by("position", "id").values_list("piece_id", "label", "score_reference")
    for piece_id, label, reference in assigned:
        solos[piece_id].append(Solo(label=_one_line(label), score_reference=_one_line(reference)))

    cast = bool(own_lines) or bool(solos)
    parts: list[PerformerPart] = []
    for item in items:
        mine = own_lines.get(item.piece_id, set())
        piece_solos = solos.get(item.piece_id, [])
        if cast and not mine and not piece_solos:
            continue
        edition = resolve_item_edition(item)
        scope = voice_scope(
            requirements[item.piece_id], edition.pk if edition else None, lines_in_piece[item.piece_id],
        )
        parts.append(PerformerPart(
            composer=str(item.piece.composer) if item.piece.composer is not None else "",
            title=item.piece.title,
            is_encore=item.is_encore,
            line=", ".join(
                _line_label(code, scope)
                for code in sorted(mine, key=lambda code: _LINE_ORDER.get(code, len(_LINE_ORDER)))
            ),
            solos=tuple(piece_solos),
        ))
    return parts


_ATTENDED = frozenset({Attendance.Status.PRESENT, Attendance.Status.LATE})


def _minutes_attended(rehearsal: Rehearsal, record: Attendance) -> int | None:
    if rehearsal.duration_minutes is None:
        return None
    if record.status == Attendance.Status.LATE and record.minutes_late is None:
        return None
    late = (record.minutes_late or 0) if record.status == Attendance.Status.LATE else 0
    return max(rehearsal.duration_minutes - late, 0)


def _known_sum(minutes: Iterable[int | None]) -> int | None:
    values = list(minutes)
    if any(value is None for value in values):
        return None
    return sum(value for value in values if value is not None)


def _format_hours(minutes: int) -> str:
    hours, remainder = divmod(minutes, 60)
    return f"{hours}:{remainder:02d}"


def _rehearsal_minutes(project: Project, seat: Participation) -> dict[date, list[int | None]]:
    """The rehearsal days of a cast member's hours record. An attended
    rehearsal counts its length less the lateness recorded; a mandatory one
    that called them with no attendance taken prints with its hours blank, for
    the pen; an absence is left out. A rehearsal leader's missing record also
    leaves a blank, independently of the singers' invitation rules."""
    records = {
        record.rehearsal_id: record
        for record in Attendance.objects.filter(participation=seat, rehearsal__project=project)
    }
    days: dict[date, list[int | None]] = defaultdict(list)
    for rehearsal in Rehearsal.objects.filter(project=project).prefetch_related("invited_participations"):
        record = records.get(rehearsal.pk)
        minutes: int | None
        if record is not None:
            if record.status not in _ATTENDED:
                continue
            minutes = _minutes_attended(rehearsal, record)
        else:
            invited = {invitee.pk for invitee in rehearsal.invited_participations.all() if not invitee.is_deleted}
            leads = (rehearsal.led_by_id or project.conductor_id) == seat.artist_id
            if seat.artist.voice_type == VoiceType.CONDUCTOR and not leads:
                continue
            if not leads and (not rehearsal.is_mandatory or not rehearsal.calls_seat(seat, invited)):
                continue
            minutes = None
        days[local_date(rehearsal.date_time, rehearsal.timezone)].append(minutes)
    return days


def _whole_month(concert_day: date) -> list[HoursSheet]:
    _, length = calendar.monthrange(concert_day.year, concert_day.month)
    rows = tuple(HoursRow(day=concert_day.replace(day=n), hours="") for n in range(1, length + 1))
    return [HoursSheet(
        month=MONTH_NAMES[concert_day.month - 1], year=concert_day.year, rows=rows, total="", full_month=True,
    )]


def _in_period(day: date, period: Period) -> bool:
    return (period.start is None or period.start <= day) and day <= period.end


def _sheets(days: dict[date, list[int | None]], concert_day: date, period: Period | None) -> list[HoursSheet]:
    days = defaultdict(list, {day: list(minutes) for day, minutes in days.items()})
    days[concert_day].append(None)
    if period is not None:
        days = defaultdict(list, {day: minutes for day, minutes in days.items() if _in_period(day, period)})

    sheets: list[HoursSheet] = []
    for (year, month), group in groupby(sorted(days.items()), key=lambda entry: (entry[0].year, entry[0].month)):
        per_day = [(day, _known_sum(minutes)) for day, minutes in group]
        total = _known_sum(minutes for _, minutes in per_day)
        sheets.append(HoursSheet(
            month=MONTH_NAMES[month - 1],
            year=year,
            rows=tuple(
                HoursRow(day=day, hours=_format_hours(minutes) if minutes is not None else "")
                for day, minutes in per_day
            ),
            total=_format_hours(total) if total is not None else "",
            full_month=False,
        ))
    return sheets


def hours_record(project: Project, seat: Participation | None, period: Period | None) -> list[HoursSheet]:
    """An umowa zlecenia's hours record, one sheet per month, in the layout of
    the accounting office's form. A cast member's sheets list their rehearsal
    days and the concert day, whose hours are always blank: the app knows when
    a concert starts, not how long anyone works it. Days outside the contract's
    period do not print. Crew, whose working days the app does not know, get the
    concert's whole month to fill in."""
    concert_day = local_date(project.date_time, project.timezone)
    if seat is None:
        return _whole_month(concert_day)
    return _sheets(_rehearsal_minutes(project, seat), concert_day, period)


def _artistic_mandate(
    project: Project, seat: Participation | None, concert_day: date,
) -> tuple[Period, list[HoursSheet]]:
    """An artistic umowa zlecenia's period and hours record, from one read of
    the person's rehearsal days. The period opens on the first day of their own
    record, so a rehearsal that never called them does not reach back: a player
    called to the dress rehearsal alone starts there, not at the choir's first
    rehearsal. A player outside the cast has no days in the app, so the start is
    left to the pen. Whether a contract signed near the concert may reach back
    over the rehearsals at all is still open with the accounting office."""
    if seat is None:
        return Period(start=None, end=concert_day), _whole_month(concert_day)
    days = _rehearsal_minutes(project, seat)
    period = Period(start=min(concert_day, min(days, default=concert_day)), end=concert_day)
    return period, _sheets(days, concert_day, period)


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
        "snapshot",
    ).get(pk=contract.pk)


# Where a snapshot's text had its `@font-face` rules: they are absolute file
# URIs on the host that rendered it, so each print fills them in anew.
_FONT_FACES_SLOT = "/* finance: brand font faces */"


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


def _snapshot_of(contract: Contract) -> ContractSnapshot | None:
    try:
        return contract.snapshot
    except ContractSnapshot.DoesNotExist:
        return None


def render_contract_html(contract: Contract) -> str:
    """The contract with its annexes, as the HTML the PDF engine receives: the
    snapshot once the signature is recorded, the live concert until then."""
    contract = _load(contract)
    _assert_printable(contract)
    snapshot = _snapshot_of(contract)
    html = snapshot.html if snapshot is not None else _compose_contract_html(contract)
    return html.replace(_FONT_FACES_SLOT, _brand_font_context()["font_css"])


def snapshot_html(contract: Contract) -> str:
    """The text a contract's snapshot keeps, composed from the live concert.
    Raises `ContractRefused` for a legacy row the template does not cover."""
    contract = _load(contract)
    _assert_printable(contract)
    return _compose_contract_html(contract)


def _compose_contract_html(contract: Contract) -> str:
    """The contract from the live concert, with the font rules left as a slot."""
    context = _document_context(contract)
    context["font_css"] = mark_safe(_FONT_FACES_SLOT)
    item = contract.cost_item
    project = item.budget.project
    if contract.form in (FeeForm.DZIELO, FeeForm.ZLECENIE):
        seat = item.participation
        performer = seat is not None and _is_performer(item, context["subject"])
        conductor = seat is not None and seat.artist.voice_type == VoiceType.CONDUCTOR
        artistic = is_artistic_payee(seat, item.crew_assignment)
        if contract.form == FeeForm.DZIELO and not artistic:
            raise ContractRefused()
        context["performer"] = performer
        context["artistic"] = artistic
        context["conductor"] = conductor
        if seat is not None and performer:
            context["parts"] = performer_parts(project, seat)
        elif artistic:
            context["programme"] = programme(project)
        if contract.form == FeeForm.ZLECENIE:
            concert_day = context["concert"].day
            if artistic:
                context["period"], context["hours_sheets"] = _artistic_mandate(project, seat, concert_day)
            else:
                context["period"], context["hours_sheets"] = None, _whole_month(concert_day)
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
