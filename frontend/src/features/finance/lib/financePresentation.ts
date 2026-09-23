/**
 * @file financePresentation.ts
 * @description The finance vocabulary — forms of settlement, cost categories,
 * plan units and sections, expense documents, budget states, the history's
 * acts and the server's warnings — in one table per taxonomy. The server sends
 * codes and never words; this file owns the words, the tone and the one
 * question each warning asks of the manager.
 * Severity follows the canon: `work` is gold, ordinary unfinished business;
 * `problem` is crimson and reserved for something actually wrong.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/financePresentation
 */

import type { TFunction } from "i18next";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type {
  BudgetStatus,
  BudgetWarningDTO,
  CostCategory,
  ExpenseDocumentType,
  FeeForm,
  HistoryEventDTO,
  IsoDate,
  LedgerRowDTO,
  PlanSection,
  PlanUnit,
  WarningSeverity,
} from "../types/finance.dto";
import { fallbackFormFor } from "./feeDraft";
import { formatLedgerAmount } from "./money";

const FORM_LABELS: Record<FeeForm, string> = {
  DZIELO: "Umowa o dzieło",
  ZLECENIE: "Umowa zlecenia",
  INVOICE: "Faktura",
  VOLUNTEER: "Wolontariat",
  OTHER: "Inna forma",
};

/** The chip's word: short, because it sits in a row beside a figure. */
const FORM_SHORT_LABELS: Record<FeeForm, string> = {
  DZIELO: "Dzieło",
  ZLECENIE: "Zlecenie",
  INVOICE: "Faktura",
  VOLUNTEER: "Wolontariat",
  OTHER: "Inna",
};

const CATEGORY_LABELS: Record<CostCategory, string> = {
  PERSONNEL_ARTISTIC: "Personel artystyczny",
  PERSONNEL_TECHNICAL: "Personel techniczny",
  VENUE: "Miejsce",
  TRAVEL: "Podróże",
  ACCOMMODATION: "Noclegi",
  CATERING: "Wyżywienie",
  MATERIALS: "Materiały i prawa",
  EQUIPMENT: "Sprzęt",
  PROMOTION: "Promocja",
  RECORDING: "Nagranie",
  ADMINISTRATION: "Administracja",
  OTHER: "Inne",
};

const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  PLANNING: "Planowanie",
  APPROVED: "Zatwierdzony",
  CLOSED: "Zamknięty",
};

export const formLabel = (t: TFunction, form: FeeForm): string =>
  t(`finance.forms.${form}`, FORM_LABELS[form]);

export const formShortLabel = (t: TFunction, form: FeeForm): string =>
  t(`finance.forms_short.${form}`, FORM_SHORT_LABELS[form]);

export const categoryLabel = (t: TFunction, category: CostCategory): string =>
  t(`finance.categories.${category}`, CATEGORY_LABELS[category]);

/**
 * The resting state — a budget still being planned — has no label to print:
 * every budget sits there until the board approves one, so a chip saying so on
 * each project buries the one that was actually approved or closed.
 */
export const budgetStatusLabel = (
  t: TFunction,
  status: BudgetStatus,
): string | null =>
  status === "PLANNING"
    ? null
    : t(`finance.budget_status.${status}`, BUDGET_STATUS_LABELS[status]);

/** The state's name where the state itself is the subject — the standing card. */
export const budgetStatusName = (t: TFunction, status: BudgetStatus): string =>
  t(`finance.budget_status.${status}`, BUDGET_STATUS_LABELS[status]);

/** A budget that is not closed, whatever the plan says. */
export const isBudgetWritable = (status: BudgetStatus): boolean => status !== "CLOSED";

/** The plan changes only while it is being planned. */
export const isPlanEditable = (status: BudgetStatus): boolean => status === "PLANNING";

/**
 * The form a row's chip states, or null when it is the form the row would get
 * anyway. The expected outcome is never printed; the exception is.
 */
export const exceptionalForm = (row: LedgerRowDTO, form: FeeForm): FeeForm | null =>
  form === fallbackFormFor(row) ? null : form;

// ── The plan ──────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<PlanUnit, string> = {
  PERSON: "Osoba",
  PIECE: "Sztuka",
  SERVICE: "Usługa",
  HOUR: "Godzina",
  DAY: "Dzień",
  NIGHT: "Nocleg",
  KM: "Kilometr",
  LUMP_SUM: "Ryczałt",
};

/** What follows a quantity: "8 os.", "200 szt.". */
const UNIT_SHORT_LABELS: Record<PlanUnit, string> = {
  PERSON: "os.",
  PIECE: "szt.",
  SERVICE: "usł.",
  HOUR: "godz.",
  DAY: "dn.",
  NIGHT: "nocl.",
  KM: "km",
  LUMP_SUM: "ryczałt",
};

const SECTION_LABELS: Record<PlanSection, string> = {
  I: "Koszty realizacji działań",
  II: "Koszty administracyjne",
};

export const unitLabel = (t: TFunction, unit: PlanUnit): string =>
  t(`finance.units.${unit}`, UNIT_LABELS[unit]);

export const unitShortLabel = (t: TFunction, unit: PlanUnit): string =>
  t(`finance.units_short.${unit}`, UNIT_SHORT_LABELS[unit]);

export const sectionLabel = (t: TFunction, section: PlanSection): string =>
  t(`finance.plan.sections.${section}`, SECTION_LABELS[section]);

/** A quantity as a figure: `"8.00"` → "8", `"2.50"` → "2,5". */
export const formatQuantity = (value: string): string => {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole},${trimmed}` : whole;
};

// ── Expenses ──────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<ExpenseDocumentType, string> = {
  INVOICE: "Faktura",
  BILL: "Rachunek",
  RECEIPT: "Paragon",
  OTHER: "Inny dokument",
};

export const documentTypeLabel = (t: TFunction, type: ExpenseDocumentType): string =>
  t(`finance.document_types.${type}`, DOCUMENT_TYPE_LABELS[type]);

// ── History ───────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  IMPORTED: "Przeniesiono z obsady",
  CREATED: "Dodano",
  PRICED: "Zmieniono kwotę",
  FORM_CHANGED: "Zmieniono formę rozliczenia",
  DETAILS_CHANGED: "Zmieniono szczegóły",
  PAID: "Oznaczono zapłatę",
  UNPAID: "Cofnięto zapłatę",
  REMOVED: "Usunięto",
  CONTRACT_ISSUED: "Wystawiono umowę",
  CONTRACT_SIGNED: "Umowa podpisana",
  CONTRACT_HOURS: "Potwierdzono godziny",
  CONTRACT_ANNULLED: "Unieważniono umowę",
  BUDGET_APPROVED: "Zatwierdzono kosztorys",
  BUDGET_REOPENED: "Otwarto ponownie",
  BUDGET_CLOSED: "Zamknięto budżet",
  PLAN_CHANGED: "Zmieniono kosztorys",
  ALLOCATION_CHANGED: "Zmieniono przydział",
};

export const historyActionLabel = (t: TFunction, action: string): string =>
  t(`finance.history.actions.${action}`, ACTION_LABELS[action] ?? action);

const asText = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

/**
 * The one change an act is remembered by, as a short "before → after": an
 * amount, a paid date, the budget's state. Acts whose change is the act itself
 * (a contract issued, a file added) say nothing more.
 */
export const historyChange = (
  t: TFunction,
  event: HistoryEventDTO,
  language: string,
): string | null => {
  const amountKey = ["contract_amount", "cost_amount", "planned_amount"].find(
    (key) => key in event.after || key in event.before,
  );
  if (amountKey && event.action !== "CREATED" && event.action !== "REMOVED") {
    const before = asText(event.before[amountKey]);
    const after = asText(event.after[amountKey]);
    const currency = t("common.currency", "PLN");
    const show = (value: string | null): string =>
      value === null ? "–" : `${formatLedgerAmount(value) ?? value} ${currency}`;
    if (before !== after) return `${show(before)} → ${show(after)}`;
  }
  if (event.action === "PAID") {
    const paidOn = asText(event.after.paid_on);
    return paidOn ? formatFinanceDate(paidOn, language) : null;
  }
  const statusBefore = asText(event.before.status);
  const statusAfter = asText(event.after.status);
  if (event.subject_type === "budget" && statusBefore && statusAfter) {
    const label = (status: string): string =>
      t(`finance.budget_status.${status}`, BUDGET_STATUS_LABELS[status as BudgetStatus] ?? status);
    return `${label(statusBefore)} → ${label(statusAfter)}`;
  }
  return null;
};

// ── Warnings ──────────────────────────────────────────────────────────────

interface WarningCopy {
  readonly title: string;
  /** What to do about it, in one sentence. */
  readonly hint: string;
}

/** The codes the server computes before funding sources exist. */
const WARNING_COPY: Record<string, WarningCopy> = {
  PAID_FOR_DECLINED: {
    title: "Wypłacone mimo odmowy udziału",
    hint: "Osoba odmówiła udziału, a jej honorarium jest oznaczone jako wypłacone. Sprawdź to z biurem.",
  },
  BELOW_MINIMUM_HOURLY_RATE: {
    title: "Poniżej minimalnej stawki godzinowej",
    hint: "Kwota umowy zlecenia podzielona przez potwierdzone godziny jest niższa niż stawka minimalna ({{minimum}} zł za godzinę w {{year}} r.).",
  },
  UNPRICED: {
    title: "Bez stawki",
    hint: "Wpisz kwotę albo wybierz wolontariat — dopiero wtedy koszt koncertu jest pełny.",
  },
  ORPHANED_FEE: {
    title: "Poza obsadą, niewypłacone",
    hint: "Tych osób nie ma już w obsadzie. Ich honoraria nie wliczają się do kosztu.",
  },
  EMPLOYER_COST_MISSING: {
    title: "Brak składek pracodawcy",
    hint: "Umowa zlecenia liczy się bez składek, dopóki biuro ich nie poda. Wpisz je w szczegółach pozycji.",
  },
  HOURS_MISSING: {
    title: "Brak potwierdzonych godzin",
    hint: "Koncert się odbył. Wpisz godziny z potwierdzenia, zanim biuro wypłaci zlecenie.",
  },
  VOLUNTEER_INSURANCE: {
    title: "Ubezpieczenie NNW wolontariuszy",
    hint: "Porozumienie trwa nie dłużej niż 30 dni, więc fundacja musi ubezpieczyć wolontariusza od następstw nieszczęśliwych wypadków.",
  },
  NOT_SIGNED: {
    title: "Umowy niepodpisane",
    hint: "Koncert się odbył. Oznacz umowy jako podpisane i zapisz, gdzie leży egzemplarz.",
  },
  DOCUMENT_MISSING: {
    title: "Brak dokumentu przed koncertem",
    hint: "Do koncertu zostało kilka dni. Wystaw umowę albo wpisz numer faktury.",
  },
  PAID_WITHOUT_DOCUMENT: {
    title: "Wypłacone bez umowy w panelu",
    hint: "Jeśli umowa istnieje na papierze, wystaw ją także tutaj — ewidencja musi się zgadzać.",
  },
  PAYMENT_OVERDUE: {
    title: "Po terminie płatności",
    hint: "Termin minął, a pozycja nie jest oznaczona jako zapłacona.",
  },
  COST_OUTSIDE_PLAN: {
    title: "Koszty poza kosztorysem",
    hint: "Budżet ma kosztorys, a te koszty nie są przypisane do żadnej jego pozycji. Przypisz je w Kosztorysie albo w szczegółach kosztu.",
  },
  LINE_OVER_PLAN: {
    title: "Pozycje ponad plan",
    hint: "Wydano więcej, niż przewiduje kosztorys. Przy grancie przekroczenie pozycji może wymagać aneksu — sprawdź umowę.",
  },
};

const UNKNOWN_WARNING: WarningCopy = {
  title: "Wymaga uwagi",
  hint: "Sprawdź wskazane pozycje.",
};

export const warningTitle = (t: TFunction, warning: BudgetWarningDTO): string => {
  const copy = WARNING_COPY[warning.code];
  return copy
    ? t(`finance.warnings.${warning.code}.title`, copy.title)
    : t("finance.warnings.unknown.title", UNKNOWN_WARNING.title);
};

export const warningHint = (t: TFunction, warning: BudgetWarningDTO): string => {
  const copy = WARNING_COPY[warning.code];
  if (!copy) return t("finance.warnings.unknown.hint", UNKNOWN_WARNING.hint);

  // The server sends the minimum rate as a decimal string; the sentence prints
  // it the way every other amount in the panel reads.
  const minimum = warning.params.minimum;
  const params =
    typeof minimum === "string"
      ? { ...warning.params, minimum: formatLedgerAmount(minimum) ?? minimum }
      : warning.params;
  return t(`finance.warnings.${warning.code}.hint`, copy.hint, { ...params });
};

export const SEVERITY_TEXT: Record<WarningSeverity, "gold" | "crimson"> = {
  work: "gold",
  problem: "crimson",
};

/**
 * Every warning that names this subject — a ledger row's key, an expense's or
 * a plan line's id — problems first (the server's order).
 */
export const warningsFor = (
  warnings: readonly BudgetWarningDTO[],
  rowKey: string,
): BudgetWarningDTO[] =>
  warnings.filter((warning) => warning.subject_ids.includes(rowKey));

// ── Dates ─────────────────────────────────────────────────────────────────

/**
 * A calendar date the API writes as `yyyy-MM-dd`: "12 paź 2026". Formatted in
 * UTC because it is a day, not a moment — local midnight in a zone west of
 * Greenwich would print the day before.
 */
export const formatFinanceDate = (value: IsoDate, language?: string): string =>
  formatLocalizedDate(
    value,
    { day: "numeric", month: "short", year: "numeric" },
    language,
    "UTC",
  );

/** Today as the API's calendar date, in the manager's own day. */
export const todayIsoDate = (): IsoDate => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
