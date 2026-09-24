"""
@file vocabulary.py
@description The Polish words of every paper and export the panel hands out —
             the office's ledger, the grantor's kosztorys, the reports and the
             document notes. Those readers read Polish whatever language the
             manager uses, so these are fixed strings and deliberately not
             gettext'd, like the contracts. The panel's own labels live in the
             client's locales; the two are kept saying the same thing.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/vocabulary
"""
from ..models import (
    BudgetStatus,
    ContractStatus,
    CostCategory,
    ExpenseDocumentType,
    FeeForm,
    FundingKind,
    FundingStatus,
    PlanUnit,
)

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

FORM_LABELS: dict[str, str] = {
    FeeForm.DZIELO: "Umowa o dzieło",
    FeeForm.ZLECENIE: "Umowa zlecenia",
    FeeForm.INVOICE: "Faktura",
    FeeForm.VOLUNTEER: "Wolontariat",
    FeeForm.OTHER: "Inna",
}

# The same in a narrow column under the head "Forma".
FORM_SHORT_LABELS: dict[str, str] = {
    FeeForm.DZIELO: "dzieło",
    FeeForm.ZLECENIE: "zlecenie",
    FeeForm.INVOICE: "faktura",
    FeeForm.VOLUNTEER: "wolontariat",
    FeeForm.OTHER: "inna",
}

# An expense's "form" names the vendor's document.
DOCUMENT_TYPE_LABELS: dict[str, str] = {
    ExpenseDocumentType.INVOICE: "Faktura",
    ExpenseDocumentType.BILL: "Rachunek",
    ExpenseDocumentType.RECEIPT: "Paragon",
    ExpenseDocumentType.OTHER: "Inny dokument",
}

# A live contract is issued or signed; an annulled one is never on a row.
CONTRACT_STATUS_LABELS: dict[str, str] = {
    ContractStatus.ISSUED: "Wystawiona",
    ContractStatus.SIGNED: "Podpisana",
}

# "Rodzaj miary" in a kosztorys: lower case, as the grant forms write it.
UNIT_LABELS: dict[str, str] = {
    PlanUnit.PERSON: "osoba",
    PlanUnit.PIECE: "sztuka",
    PlanUnit.SERVICE: "usługa",
    PlanUnit.HOUR: "godzina",
    PlanUnit.DAY: "dzień",
    PlanUnit.NIGHT: "nocleg",
    PlanUnit.KM: "km",
    PlanUnit.LUMP_SUM: "ryczałt",
}

FUNDING_KIND_LABELS: dict[str, str] = {
    FundingKind.PUBLIC_GRANT: "Dotacja publiczna",
    FundingKind.PRIVATE_GRANT: "Grant prywatny",
    FundingKind.SPONSOR: "Sponsor",
    FundingKind.DONATIONS: "Darowizny",
    FundingKind.TICKETS: "Bilety",
    FundingKind.OWN_FUNDS: "Środki własne",
    FundingKind.IN_KIND: "Wkład rzeczowy",
    FundingKind.VOLUNTEER_WORK: "Wkład osobowy (wolontariat)",
}

FUNDING_STATUS_LABELS: dict[str, str] = {
    FundingStatus.PLANNED: "Planowane",
    FundingStatus.APPLIED: "Wniosek złożony",
    FundingStatus.AWARDED: "Przyznane",
    FundingStatus.REJECTED: "Odrzucone",
    FundingStatus.SETTLED: "Rozliczone",
}

BUDGET_STATUS_LABELS: dict[str, str] = {
    BudgetStatus.PLANNING: "Planowanie",
    BudgetStatus.APPROVED: "Zatwierdzony",
    BudgetStatus.CLOSED: "Zamknięty",
}

# PLANNING with no kosztorys lines: nothing is being planned, the books are
# simply open.
BUDGET_OPEN_LABEL = "Otwarty"

# The patron report speaks to someone outside the office: a cost is named by
# what it paid for, and a funding kind in the plural, as a sum of sources.
PATRON_CATEGORY_LABELS: dict[str, str] = {
    CostCategory.PERSONNEL_ARTISTIC: "Honoraria artystów",
    CostCategory.PERSONNEL_TECHNICAL: "Obsługa techniczna",
    CostCategory.VENUE: "Miejsce koncertu",
    CostCategory.TRAVEL: "Podróże",
    CostCategory.ACCOMMODATION: "Noclegi",
    CostCategory.CATERING: "Wyżywienie",
    CostCategory.MATERIALS: "Nuty i prawa autorskie",
    CostCategory.EQUIPMENT: "Instrumenty i sprzęt",
    CostCategory.PROMOTION: "Promocja i druk",
    CostCategory.RECORDING: "Nagranie",
    CostCategory.ADMINISTRATION: "Administracja",
    CostCategory.OTHER: "Inne koszty",
}
PATRON_PERSONNEL_MERGED_LABEL = "Honoraria i obsługa"
PATRON_REMAINDER_LABEL = "Pozostałe koszty"

PATRON_FUNDING_LABELS: dict[str, str] = {
    FundingKind.PUBLIC_GRANT: "Dotacje publiczne",
    FundingKind.PRIVATE_GRANT: "Granty prywatne",
    FundingKind.SPONSOR: "Sponsorzy",
    FundingKind.DONATIONS: "Darowizny",
    FundingKind.TICKETS: "Bilety",
    FundingKind.IN_KIND: "Wkład rzeczowy",
    FundingKind.VOLUNTEER_WORK: "Praca wolontariuszy",
}
PATRON_FOUNDATION_OWN_LABEL = "Środki własne fundacji"
# Sources merged so that none shows one or two people's pay on its own.
PATRON_FUNDING_MERGED_LABEL = "Pozostałe źródła"

# The panel's warning titles (`finance.warnings.<code>.title` in the Polish
# locale), for the board report.
WARNING_TITLES: dict[str, str] = {
    "PAID_FOR_DECLINED": "Wypłacone mimo odmowy udziału",
    "BELOW_MINIMUM_HOURLY_RATE": "Poniżej minimalnej stawki godzinowej",
    "SOURCE_OVERALLOCATED": "Źródło obciążone ponad swoją kwotę",
    "OUTSIDE_ELIGIBILITY": "Koszt poza okresem kwalifikowalności",
    "OWN_SHARE_BELOW": "Za mały wkład własny",
    "ADMIN_CAP_EXCEEDED": "Za dużo kosztów administracyjnych",
    "UNPRICED": "Bez stawki",
    "ORPHANED_FEE": "Poza obsadą, niewypłacone",
    "EMPLOYER_COST_MISSING": "Brak składek pracodawcy",
    "HOURS_MISSING": "Brak potwierdzonych godzin",
    "VOLUNTEER_INSURANCE": "Ubezpieczenie NNW wolontariuszy",
    "NOT_SIGNED": "Umowy niepodpisane",
    "DOCUMENT_MISSING": "Brak dokumentu przed koncertem",
    "PAID_WITHOUT_DOCUMENT": "Wypłacone bez umowy w panelu",
    "PAYMENT_OVERDUE": "Po terminie płatności",
    "COST_OUTSIDE_PLAN": "Koszty poza kosztorysem",
    "LINE_OVER_PLAN": "Pozycje ponad plan",
    "REPORT_DUE_SOON": "Termin sprawozdania",
}
