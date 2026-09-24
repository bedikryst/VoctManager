/**
 * @file financeErrors.ts
 * @description The finance API's refusals in the manager's language. Every
 * refusal carries a stable `error_code`; the sentence the server attaches is
 * English and never reaches the screen. A code this table does not know falls
 * through to the shared toast, which picks words by the kind of failure. A
 * refused payment also names what it refused, so a list can mark those rows.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/financeErrors
 */

import type { TFunction } from "i18next";

import { parseApiError, toastApiError } from "@/shared/api/errors";

const FINANCE_ERROR_COPY: Record<string, string> = {
  budget_locked: "Budżet jest zamknięty. Zarząd musi go najpierw otworzyć.",
  unknown_fee_reference: "Tej pozycji nie ma już w projekcie. Odśwież stronę.",
  seat_not_billable: "Tej osoby nie ma w obsadzie albo odmówiła udziału, więc nie można jej wycenić.",
  item_paid: "Pozycja jest wypłacona. Kwoty ani formy nie można zmienić bez cofnięcia płatności.",
  item_contracted: "Umowa jest wystawiona. Kwota i forma są zamrożone do jej unieważnienia.",
  invalid_item_change: "Tego pola nie można zmienić w tej pozycji.",
  payment_refused: "Nie wszystkie zaznaczone pozycje można oznaczyć jako wypłacone. Nic nie zostało zmienione.",
  not_paid: "Ta pozycja nie jest oznaczona jako wypłacona.",
  contract_refused: "Dla tej pozycji nie można wystawić umowy.",
  contract_exists: "Ta pozycja ma już wystawioną umowę.",
  contract_annulled: "Ta umowa jest unieważniona.",
  hours_not_applicable: "Godziny potwierdza się tylko w umowie zlecenia.",
  bill_not_applicable: "Do porozumienia wolontariackiego nie wystawia się rachunku.",
  pdf_renderer_unavailable: "Serwer nie może teraz przygotować dokumentu. Spróbuj za chwilę.",
  no_contracts: "Projekt nie ma jeszcze żadnej wystawionej umowy.",
  zip_failed: "Nie udało się spakować umów. Spróbuj ponownie.",
  zip_timeout: "Pakowanie umów trwa zbyt długo. Spróbuj ponownie za kilka minut.",
  item_paid_not_removable: "Pozycja jest zapłacona. Usunąć ją można dopiero po cofnięciu zapłaty.",
  fee_not_orphaned: "Ta osoba wciąż jest w obsadzie, więc jej honorarium zostaje. Odśwież stronę.",
  plan_locked: "Kosztorys jest zatwierdzony. Korektę otwiera zarząd na karcie Przegląd.",
  unknown_plan_line: "Tej pozycji kosztorysu już nie ma. Odśwież stronę.",
  plan_line_category_mismatch: "Koszt przypisuje się do pozycji kosztorysu tego samego rodzaju.",
  line_order_mismatch: "Kosztorys zmienił się w międzyczasie. Odśwież stronę i ułóż pozycje jeszcze raz.",
  plan_amount_too_large: "Ilość razy cena jednostkowa daje kwotę większą, niż mieści budżet. Sprawdź liczby.",
  amount_too_large: "Koszt albo wycena pracy wychodzi większa, niż mieści budżet. Sprawdź kwotę, składki i godziny.",
  budget_transition_refused: "Budżet jest już w innym stanie. Odśwież stronę.",
  budget_has_open_items: "Budżetu nie można zamknąć: są jeszcze niezapłacone koszty, osoby bez stawki, honoraria poza obsadą albo umowy zlecenia bez składek pracodawcy.",
  crew_has_settled_fee: "Ta osoba ma wypłacone honorarium albo wystawioną umowę. Najpierw cofnij płatność albo unieważnij umowę w Finansach.",
  attachment_not_allowed: "Pliki dołącza się tylko do wydatków.",
  attachment_missing: "Nie wybrano pliku.",
  attachment_too_large: "Plik jest za duży — limit to 20 MB.",
  attachment_type_not_allowed: "Dołączyć można PDF albo zdjęcie dokumentu (JPG, PNG, WEBP, HEIC).",
  file_detection_unavailable: "Serwer nie może teraz sprawdzić pliku. Spróbuj za chwilę.",
  unknown_funding: "Tego źródła nie ma już w projekcie. Odśwież stronę.",
  unknown_source: "Tego źródła finansowania już nie ma. Odśwież stronę.",
  funding_exists: "To źródło jest już w projekcie.",
  funding_in_use: "To źródło obciążają już koszty. Najpierw zdejmij je ze źródła, potem usuń źródło z projektu.",
  source_in_use: "Źródło finansuje jakiś projekt. Usuń je najpierw ze wszystkich projektów.",
  source_settled: "Źródło jest rozliczone — tego, czym je obciążono, już się nie zmienia. Aby coś poprawić, zmień jego status.",
  source_kind_in_use: "Tym źródłem obciążono już koszty, których nowy rodzaj nie przyjmie. Najpierw zdejmij je ze źródła.",
  eligibility_period_invalid: "Okres kwalifikowalności kończy się przed swoim początkiem.",
  allocation_exceeds_amount: "Źródła pokryłyby więcej niż cała kwota. Zmniejsz obciążenie źródeł.",
  allocation_kind_mismatch: "Pieniądze obciąża się na źródło pieniędzy, a pracę wolontariusza — na wkład osobowy.",
  allocation_not_counted: "Ten koszt się nie liczy (np. osoba odmówiła udziału), więc nie obciąża się nim źródeł. Można go tylko z nich zdjąć.",
  charge_refused: "Nie każdy z tych kosztów można obciążyć na to źródło. Nic nie zostało zmienione.",
  report_source_invalid: "Tego źródła nie ma już w projekcie albo nie wnosi pieniędzy. Odśwież stronę i wybierz źródło jeszcze raz.",
  patron_report_below_floor: "Cały koszt koncertu to honoraria jednej lub dwóch osób, więc sprawozdanie dla mecenasa ujawniłoby ich kwoty. Takiego sprawozdania się nie przygotowuje.",
};

/** The manager's sentence for a finance refusal code, or null if unknown. */
export const financeErrorCopy = (t: TFunction, code: string | null): string | null => {
  if (!code || !(code in FINANCE_ERROR_COPY)) return null;
  return t(`finance.errors.${code}`, FINANCE_ERROR_COPY[code]);
};

/** Why the server refused one cost of a payment (`params.refused[].reason`). */
export type PaymentRefusalReason = "unknown" | "unpriced" | "volunteer" | "already_paid" | "budget_locked";

const ITEM_REFUSAL_REASONS: ReadonlySet<string> = new Set([
  "unknown",
  "unpriced",
  "volunteer",
  "already_paid",
]);

const isItemReason = (value: unknown): value is PaymentRefusalReason =>
  typeof value === "string" && ITEM_REFUSAL_REASONS.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const refusalParams = (error: unknown): Record<string, unknown> | null => {
  if (!isRecord(error) || !isRecord(error.response)) return null;
  const data = error.response.data;
  return isRecord(data) && isRecord(data.params) ? data.params : null;
};

/**
 * A refused payment's own account of what it refused, when it gave one: the
 * cost ids it named (`payment_refused`), or the projects whose closed budget
 * refused the whole call (`budget_locked`). Nothing was paid either way.
 */
export interface PaymentRefusals {
  readonly items: ReadonlyMap<string, PaymentRefusalReason>;
  readonly closedProjects: ReadonlySet<string>;
}

export const paymentRefusals = (error: unknown): PaymentRefusals | null => {
  const { code } = parseApiError(error);
  const params = refusalParams(error);
  if (!params) return null;

  if (code === "payment_refused" && Array.isArray(params.refused)) {
    const items = new Map<string, PaymentRefusalReason>();
    for (const entry of params.refused) {
      if (!isRecord(entry) || typeof entry.id !== "string") continue;
      items.set(entry.id, isItemReason(entry.reason) ? entry.reason : "unknown");
    }
    return { items, closedProjects: new Set() };
  }

  if (code === "budget_locked" && Array.isArray(params.project_ids)) {
    const closedProjects = new Set(
      params.project_ids.filter((id): id is string => typeof id === "string"),
    );
    return { items: new Map(), closedProjects };
  }

  return null;
};

export const toastFinanceError = (
  error: unknown,
  t: TFunction,
  fallbackDescription: string,
  toastId?: string | number,
): void => {
  const copy = financeErrorCopy(t, parseApiError(error).code);
  toastApiError(error, t, {
    ...(toastId !== undefined ? { id: toastId } : {}),
    ...(copy ? { description: copy } : { fallbackDescription }),
  });
};
