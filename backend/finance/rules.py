"""
@file rules.py
@description The money rules as pure functions: which form a person is settled
             under by default, which cost category a fee falls into, what the
             foundation's cost of an item is, how "0 zł" and "volunteer" keep
             meaning the same thing, and the constants the warnings read. Nothing
             here touches the database, so the ledger service, the warnings and
             the roster data copy all ask the same questions of the same code.
@architecture Enterprise SaaS 2026
@module finance/rules
"""
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone, translation

from roster.models import DEFAULT_EVENT_TIMEZONE, Collaborator, CrewAssignment, Participation, VoiceType

from .models import CostCategory, FeeForm

CENT = Decimal('0.01')
ZERO = Decimal('0.00')

# Where "today" is decided: the foundation's office, not the server's UTC clock.
# A payment made on the evening of the 31st belongs to that month in the books.
FINANCE_TIMEZONE = ZoneInfo(DEFAULT_EVENT_TIMEZONE)

# The one place contract numbers are shaped. The accounting office may have a
# scheme of its own; adopting it is a change to this table and nothing else.
CONTRACT_NUMBER_FORMATS: dict[str, str] = {
    FeeForm.DZIELO: 'UoD/{n}/{yyyy}',
    FeeForm.ZLECENIE: 'UZ/{n}/{yyyy}',
    FeeForm.VOLUNTEER: 'W/{n}/{yyyy}',
}

# Statutory minimum hourly rate for a contract of mandate (umowa zlecenia), per
# calendar year, from the Council of Ministers' regulation published each
# September. Checked by the office; add the next year when the regulation is out.
# A year past the table reads the latest entry: the minimum has never fallen, so
# a stale table can only under-warn, never raise a false alarm.
MINIMUM_HOURLY_RATE_PLN: dict[int, Decimal] = {
    2025: Decimal('30.50'),
    2026: Decimal('31.40'),
}

# Art. 46 of the Public Benefit and Volunteer Work Act: a volunteer engaged for
# up to 30 days must be insured against accidents by the organisation.
VOLUNTEER_INSURANCE_MAX_DAYS = 30

# How close to the concert a priced fee without its document starts to be flagged.
DOCUMENT_DUE_WINDOW_DAYS = 7

# Forms settled with a contract the foundation issues and pays out against.
PAYABLE_CONTRACT_FORMS = (FeeForm.DZIELO, FeeForm.ZLECENIE)


def money(value: Decimal) -> Decimal:
    """Rounded to the grosz, half up — the rounding a Polish accountant expects."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def finance_today() -> date:
    return timezone.localdate(timezone=FINANCE_TIMEZONE)


def local_date(moment: datetime, tz_name: str) -> date:
    """The calendar date of ``moment`` where it happened. A concert at 20:00 in
    Warsaw is on that day, whatever the server's clock says in UTC."""
    try:
        zone = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        zone = FINANCE_TIMEZONE
    return timezone.localtime(moment, zone).date()


# --------------------------------------------------------------------------- #
# Where a fee comes from                                                       #
# --------------------------------------------------------------------------- #

# Specialties whose work is a performance or a work with a verifiable result.
_DZIELO_SPECIALTIES = frozenset({Collaborator.Specialty.INSTRUMENT, Collaborator.Specialty.VISUALS})


def default_form_for(source: Participation | CrewAssignment) -> FeeForm:
    """The form a person is settled under unless somebody chooses otherwise.

    | Source                                   | Default  |
    |------------------------------------------|----------|
    | any cast seat (singer or player)         | DZIELO   |
    | collaborator with a company name         | INVOICE  |
    | collaborator INSTRUMENT, VISUALS         | DZIELO   |
    | collaborator SOUND, LIGHT, LOGISTICS, …  | ZLECENIE |

    A cast seat is an artistic performance of a named programme: a result, with
    related rights to transfer. A business invoices, so a contract of ours would
    be wrong. A technician performs a service with due care rather than delivering
    a verifiable result; a dzieło there is what ZUS reclassifies with
    contributions due retroactively. A one-off payee has no default: the form is
    chosen when the payee is added.
    """
    if isinstance(source, Participation):
        return FeeForm.DZIELO
    collaborator = source.collaborator
    if collaborator.company_name.strip():
        return FeeForm.INVOICE
    if collaborator.specialty in _DZIELO_SPECIALTIES:
        return FeeForm.DZIELO
    return FeeForm.ZLECENIE


def one_off_fallback_form(category: str) -> FeeForm:
    """The form a one-off payee falls back to when leaving volunteer work by
    typing an amount — the same split the table above draws for the roster."""
    if category == CostCategory.PERSONNEL_TECHNICAL:
        return FeeForm.ZLECENIE
    return FeeForm.DZIELO


def category_for_specialty(specialty: str) -> CostCategory:
    """Crew are technical personnel, except the players booked as crew."""
    if specialty == Collaborator.Specialty.INSTRUMENT:
        return CostCategory.PERSONNEL_ARTISTIC
    return CostCategory.PERSONNEL_TECHNICAL


def category_for(source: Participation | CrewAssignment) -> CostCategory:
    if isinstance(source, Participation):
        return CostCategory.PERSONNEL_ARTISTIC
    return category_for_specialty(source.collaborator.specialty)


def full_name(first_name: str, last_name: str) -> str:
    return f"{first_name} {last_name}".strip()


def cast_payee_role(voice_type: str, instrument: str) -> str:
    """What a cast member is paid as, in Polish: the documents are Polish, so the
    snapshot is taken in Polish whatever language the manager uses."""
    if voice_type == VoiceType.INSTRUMENTALIST and instrument.strip():
        return instrument.strip()
    with translation.override('pl'):
        return str(dict(VoiceType.choices).get(voice_type, voice_type))


def crew_payee_role(role_description: str, specialty: str) -> str:
    if role_description.strip():
        return role_description.strip()
    with translation.override('pl'):
        return str(dict(Collaborator.Specialty.choices).get(specialty, specialty))


def payee_snapshot(source: Participation | CrewAssignment) -> tuple[str, str]:
    """(name, role) as they should read on a contract signed today."""
    if isinstance(source, Participation):
        artist = source.artist
        return full_name(artist.first_name, artist.last_name), cast_payee_role(artist.voice_type, artist.instrument)
    collaborator = source.collaborator
    return (
        full_name(collaborator.first_name, collaborator.last_name),
        crew_payee_role(source.role_description, collaborator.specialty),
    )


# --------------------------------------------------------------------------- #
# Amounts                                                                      #
# --------------------------------------------------------------------------- #

def cost_for(form: str, contract_amount: Decimal | None, employer_contributions: Decimal | None) -> Decimal | None:
    """The foundation's cost of a fee: the total that leaves the foundation.

    DZIELO, INVOICE and OTHER cost their contract amount (an invoice's gross,
    since no VAT is recoverable). ZLECENIE adds the employer's contributions the
    office reports; until it has, the item counts at its contract amount and the
    ledger says the figure is missing. Volunteer work costs nothing. Unpriced has
    no cost at all, which is different from a cost of zero.
    """
    if contract_amount is None:
        return None
    if form == FeeForm.VOLUNTEER:
        return ZERO
    if form == FeeForm.ZLECENIE and employer_contributions is not None:
        return money(contract_amount + employer_contributions)
    return money(contract_amount)


def in_kind_value(hours: Decimal | None, hourly_rate: Decimal | None) -> Decimal | None:
    """The valuation of volunteer work for a grant's in-kind contribution."""
    if hours is None or hourly_rate is None:
        return None
    return money(hours * hourly_rate)


@dataclass(frozen=True)
class Pricing:
    form: str
    contract_amount: Decimal | None


def reconcile_pricing(
    current: Pricing,
    *,
    requested_form: str | None,
    requested_amount: Decimal | None,
    fallback_form: str,
) -> Pricing:
    """Apply a requested form and amount so that 0 and VOLUNTEER stay one fact.

    Whichever of the two the person actually changed decides the other:

    - choosing VOLUNTEER sets the amount to 0;
    - leaving VOLUNTEER for another form drops the volunteer's 0 to unpriced, so
      nobody ends up with "zero, but under a contract";
    - typing 0 sets the form to VOLUNTEER, even over a form sent alongside it;
    - typing a positive amount (or clearing it) on a volunteer row leaves
      volunteer work for ``fallback_form``.

    ``current`` is the stored row, or the default for a row not yet stored. The
    result always satisfies the database's `finance_item_zero_is_volunteer`.
    """
    form = requested_form or current.form or fallback_form
    amount = requested_amount
    form_changed = form != current.form
    amount_changed = amount != current.contract_amount

    if form_changed and form == FeeForm.VOLUNTEER:
        return Pricing(FeeForm.VOLUNTEER, ZERO)
    if form_changed and current.form == FeeForm.VOLUNTEER and amount is not None and amount == 0:
        return Pricing(form, None)
    if amount_changed and amount is not None and amount == 0:
        return Pricing(FeeForm.VOLUNTEER, ZERO)
    if form == FeeForm.VOLUNTEER and (amount is None or amount != 0):
        return Pricing(fallback_form, amount)
    return Pricing(form, amount)


def minimum_hourly_rate(year: int) -> Decimal | None:
    known = [known_year for known_year in MINIMUM_HOURLY_RATE_PLN if known_year <= year]
    if not known:
        return None
    return MINIMUM_HOURLY_RATE_PLN[max(known)]


def contract_number(form: str, sequence_number: int, year: int) -> str:
    return CONTRACT_NUMBER_FORMATS[form].format(n=sequence_number, yyyy=year)


def is_valid_nip(digits: str) -> bool:
    """Polish NIP checksum: weights 6,5,7,2,3,4,5,6,7 over the first nine digits,
    modulo 11, must equal the tenth. Catches the transposed digit a copied NIP
    usually carries."""
    if len(digits) != 10 or not digits.isdigit():
        return False
    weights = (6, 5, 7, 2, 3, 4, 5, 6, 7)
    checksum = sum(int(digit) * weight for digit, weight in zip(digits, weights, strict=False)) % 11
    return checksum != 10 and checksum == int(digits[9])
