/**
 * @file financePresentation.ts
 * @description The finance vocabulary — forms of settlement, cost categories,
 * budget states and the server's warnings — in one table per taxonomy. The
 * server sends codes and never words; this file owns the words, the tone and
 * the one question each warning asks of the manager.
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
  FeeForm,
  IsoDate,
  LedgerRowDTO,
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

/**
 * The form a row's chip states, or null when it is the form the row would get
 * anyway. The expected outcome is never printed; the exception is.
 */
export const exceptionalForm = (row: LedgerRowDTO, form: FeeForm): FeeForm | null =>
  form === fallbackFormFor(row) ? null : form;

// ── Warnings ──────────────────────────────────────────────────────────────

interface WarningCopy {
  readonly title: string;
  /** What to do about it, in one sentence. */
  readonly hint: string;
}

/** The codes this stage's server computes. Later stages add their own. */
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
    hint: "Termin minął, a honorarium nie jest oznaczone jako wypłacone.",
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

/** Every warning that names this row, problems first (the server's order). */
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
