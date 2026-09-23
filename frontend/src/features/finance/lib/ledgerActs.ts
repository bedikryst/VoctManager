/**
 * @file ledgerActs.ts
 * @description Which acts a ledger row can take right now, from the server's
 * own refusals. The panel offers an act only where the server would accept
 * it, so the ledger never answers a click with a 400; the few it cannot
 * predict (a row changed under another hand) still come back as a refusal
 * with words.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/ledgerActs
 */

import {
  BILLED_FORMS,
  CONTRACT_FORMS,
  type FeeForm,
  type LedgerRowDTO,
} from "../types/finance.dto";

const isContractForm = (form: FeeForm | ""): boolean =>
  form !== "" && CONTRACT_FORMS.includes(form);

/**
 * Mark paid: a priced fee above zero, not yet paid, whose seat still counts.
 * The server would take an orphan too, and the ledger would then carry a
 * payment for someone no longer in the cast — the panel does not offer it.
 */
export const canPay = (row: LedgerRowDTO): boolean =>
  row.cost_item_id !== null &&
  row.is_priced &&
  row.form !== "VOLUNTEER" &&
  !row.is_paid &&
  !row.orphaned;

/** Issue: a priced, billable fee under a form we write a document for. */
export const canIssue = (row: LedgerRowDTO): boolean =>
  row.cost_item_id !== null &&
  row.is_priced &&
  isContractForm(row.form) &&
  row.contract === null &&
  row.billable;

export const canSign = (row: LedgerRowDTO): boolean =>
  row.contract?.status === "ISSUED";

export const canConfirmHours = (row: LedgerRowDTO): boolean =>
  row.contract?.form === "ZLECENIE";

export const hasBill = (row: LedgerRowDTO): boolean =>
  row.contract !== null && BILLED_FORMS.includes(row.contract.form);

/** Board acts: reverting a payment, annulling a contract. */
export const canUnpay = (row: LedgerRowDTO): boolean =>
  row.cost_item_id !== null && row.is_paid;

export const canAnnul = (row: LedgerRowDTO): boolean => row.contract !== null;

/** A row a bulk act can reach draws a checkbox; the rest draw none. */
export const isSelectable = (row: LedgerRowDTO): boolean =>
  canPay(row) || canIssue(row);
