/**
 * @file financeErrors.ts
 * @description The finance API's refusals in the manager's language. Every
 * refusal carries a stable `error_code`; the sentence the server attaches is
 * English and never reaches the screen. A code this table does not know falls
 * through to the shared toast, which picks words by the kind of failure.
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
};

/** The manager's sentence for a finance refusal code, or null if unknown. */
export const financeErrorCopy = (t: TFunction, code: string | null): string | null => {
  if (!code || !(code in FINANCE_ERROR_COPY)) return null;
  return t(`finance.errors.${code}`, FINANCE_ERROR_COPY[code]);
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
