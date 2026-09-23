"""
@file foundation.py
@description The foundation as a party to its own documents: legal name, seat,
             register numbers, who may sign for it and where a person writes
             about their personal data. Code rather than a model: it changes
             when the KRS entry changes, and that change deserves a commit.
             Every finance PDF reads it through `foundation_context` (a paper
             nobody signs for the foundation, through
             `report_foundation_context`), the way fonts arrive through
             `_brand_font_context()`.
@architecture Enterprise SaaS 2026
@module finance/foundation
"""
from dataclasses import dataclass

from roster.duplicates import fold


class FoundationIdentityError(RuntimeError):
    """The record cannot back a document. A GDPR clause with no contact is not a
    clause, and a contract needs somebody on the foundation's side who is not
    also its payee."""


@dataclass(frozen=True)
class Representative:
    """A board member who signs for the foundation alone (statute §13.2a).

    `name` is printed in the nominative after a colon ("reprezentowana przez:
    …"), a slot Polish grammar cannot inflect. `aliases` are the other forms of
    the name the roster may hold for the same person — the name used on stage,
    say — and are read only when looking for the payee among the board.
    """

    name: str
    function: str
    user_email: str | None = None
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class Foundation:
    legal_name: str
    # "z siedzibą w Krakowie", "zawarta w Krakowie": the seat in the locative,
    # stored as such because a template can only concatenate.
    seat_locative: str
    street: str
    postal_code: str
    city: str
    krs: str
    nip: str
    regon: str
    # In signing order: a document prints the first one who is not its payee.
    representatives: tuple[Representative, ...]
    privacy_contact: str

    @property
    def address(self) -> str:
        return f"{self.street}, {self.postal_code} {self.city}"


# Checked against the KRS on 2026-09-23 (board in office since 2026-04-27). The
# full KRS names carry middle names and a capitalised particle; the printed form
# omits the middle names, and the matching below finds the payee either way.
FOUNDATION = Foundation(
    legal_name="Fundacja VoctFoundation",
    seat_locative="Krakowie",
    street="ul. Św. Filipa 23/3",
    postal_code="31-150",
    city="Kraków",
    krs="0001237252",
    nip="6762718992",
    regon="544621525",
    representatives=(
        Representative(
            name="Florentyn de Bazelaire de Boucheporn",
            function="Prezes Zarządu",
            aliases=("Florent de Bazelaire",),
            user_email="florentyn.de.bazelaire@gmail.com",
        ),
        Representative(
            name="Anna Marcisz",
            function="Wiceprezes Zarządu",
            user_email="anna.kaczka92@gmail.com",
        ),
        Representative(
            name="Krystian Bugalski",
            function="Wiceprezes Zarządu",
            user_email="krystbugalski@gmail.com",
        ),
    ),
    privacy_contact="rodo@voctfoundation.com",
)


def _name_tokens(name: str) -> frozenset[str]:
    return frozenset(fold(name).split())


def _same_person(payee: frozenset[str], known: frozenset[str]) -> bool:
    """One name's words all appear in the other's, across at least a first name
    and a surname — so "Anna Marcisz" is "Anna Elżbieta Marcisz", while a lone
    "Anna" is nobody in particular."""
    smaller, larger = sorted((payee, known), key=len)
    return len(smaller) >= 2 and smaller <= larger


def _is_payee(representative: Representative, payee: frozenset[str], payee_email: str) -> bool:
    if payee_email and representative.user_email and representative.user_email.casefold() == payee_email:
        return True
    return any(
        _same_person(payee, _name_tokens(name)) for name in (representative.name, *representative.aliases)
    )


def signatory_for(payee_name: str, payee_email: str | None = None) -> Representative:
    """The first representative who is not the document's own payee.

    The conductor sits on the board, and a contract paying him signed by him on
    the foundation's side is the conflict statute §8.5 tells a board member to
    stand aside from. An email or a name match is enough to stand aside: a false
    match only moves the signature to the next board member, who may sign alone,
    while a missed one prints a person contracting with himself.
    """
    payee = _name_tokens(payee_name)
    email = (payee_email or "").strip().casefold()
    for representative in FOUNDATION.representatives:
        if not _is_payee(representative, payee, email):
            return representative
    raise FoundationIdentityError("Every representative of the foundation is this document's payee.")


def _checked_foundation() -> Foundation:
    """Refuses a record without a GDPR contact, because the clause a contract
    carries would name nobody to write to, and a report naming people is
    personal data under the same controller."""
    if not FOUNDATION.privacy_contact.strip():
        raise FoundationIdentityError("The foundation record has no privacy contact; no document may be rendered.")
    return FOUNDATION


def foundation_context(*, payee_name: str, payee_email: str | None = None) -> dict[str, object]:
    """The parties' side of every finance document: the foundation and who signs
    for it."""
    return {
        "foundation": _checked_foundation(),
        "representative": signatory_for(payee_name, payee_email),
    }


def report_foundation_context() -> dict[str, object]:
    """The foundation on a paper nobody signs for it: a report, a sheet of
    document notes."""
    return {"foundation": _checked_foundation()}
