/**
 * @file feeDraft.ts
 * @description The Honoraria draft as pure functions: what each row will read
 * once saved, the preview totals, and the one batch that saves it.
 * Pricing is a draft committed in one atomic `PATCH fees/`; the server applies
 * the standard rate first and the rows after it, and reconciles every row so
 * that 0 and VOLUNTEER stay one fact. The preview has to predict exactly that,
 * or the rail promises a total the save does not produce — so
 * `reconcilePricing` mirrors `finance/rules.py::reconcile_pricing`,
 * `takesStandardRate` the service's skip rules and `summarizeDraft` its rule
 * for a repriced mandate's contributions, line for line.
 * Every sum here is integer grosze.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/feeDraft
 */

import type {
  CostCategory,
  FeeBatchPayload,
  FeeForm,
  FeeItemPayload,
  FeeRef,
  LedgerRowDTO,
} from "../types/finance.dto";
import { fromGrosze, toAmountInput, toGrosze } from "./money";

/** The two rosters a standard rate prices; a one-off payee has none. */
export type LedgerSide = "cast" | "crew";

/** What the manager changed on one row. An absent field keeps the row's own. */
export interface RowDraft {
  /** Sanitized input; `""` clears the price. */
  readonly amount?: string;
  readonly form?: FeeForm;
}

export type DraftMap = Readonly<Record<string, RowDraft>>;

/** Standard rates as typed, per side; an absent side has none pending. */
export type StandardRates = Readonly<Partial<Record<LedgerSide, string>>>;

export interface Pricing {
  readonly form: FeeForm;
  /** `null` is unpriced — no decision yet. 0 is a decision (volunteer). */
  readonly grosze: number | null;
}

export interface RowPreview {
  /** What the row reads before any edit. */
  readonly stored: Pricing;
  /** After the standard rate, before this row's own edit. */
  readonly base: Pricing;
  /** After everything pending. */
  readonly next: Pricing;
  /** What the amount field shows. */
  readonly amountInput: string;
  /** The row will change when the draft is saved. */
  readonly isPending: boolean;
  /** The row's own typed amount is not an amount. */
  readonly isInvalid: boolean;
}

export interface DraftSummary {
  /** Cost of every row the budget will count, in grosze. */
  readonly committed: number;
  readonly byCategory: ReadonlyMap<CostCategory, number>;
  /** Billable rows that will still carry no price. */
  readonly unpriced: number;
  /** Rows the save will change. */
  readonly pending: number;
  /** Rows (and standard rates) whose typed amount is not an amount. */
  readonly invalid: number;
}

const STANDARD_RATE_SKIPS: readonly FeeForm[] = ["VOLUNTEER", "INVOICE"];

/** A one-off falls back by its side, the split the roster table draws. */
export const fallbackFormFor = (row: LedgerRowDTO): FeeForm =>
  row.default_form ??
  (row.category === "PERSONNEL_TECHNICAL" ? "ZLECENIE" : "DZIELO");

export const sideOf = (row: LedgerRowDTO): LedgerSide | null =>
  row.origin === "one_off" ? null : row.origin;

/** The row's form as stored, or the default an unpriced row would take. */
const storedForm = (row: LedgerRowDTO): FeeForm =>
  row.form === "" ? fallbackFormFor(row) : row.form;

export const storedPricing = (row: LedgerRowDTO): Pricing => ({
  form: storedForm(row),
  grosze: toGrosze(row.contract_amount),
});

/**
 * Amount and form are open to a draft only while nothing has settled them: a
 * payment, a live contract, or a seat that is no longer in the cast.
 */
export const isPriceEditable = (row: LedgerRowDTO): boolean =>
  !row.is_paid && row.contract === null && !row.orphaned && row.billable;

/** Mirrors `finance/services/ledger.py::_takes_standard_rate`. */
export const takesStandardRate = (row: LedgerRowDTO): boolean =>
  row.origin !== "one_off" &&
  row.billable &&
  !row.is_paid &&
  row.contract === null &&
  !STANDARD_RATE_SKIPS.includes(storedForm(row));

/** Mirrors `finance/rules.py::reconcile_pricing`. */
export const reconcilePricing = (
  current: Pricing,
  requested: { readonly form?: FeeForm; readonly grosze: number | null },
  fallbackForm: FeeForm,
): Pricing => {
  const form = requested.form ?? current.form;
  const amount = requested.grosze;
  const formChanged = form !== current.form;
  const amountChanged = amount !== current.grosze;

  if (formChanged && form === "VOLUNTEER") return { form: "VOLUNTEER", grosze: 0 };
  if (formChanged && current.form === "VOLUNTEER" && amount === 0) {
    return { form, grosze: null };
  }
  if (amountChanged && amount === 0) return { form: "VOLUNTEER", grosze: 0 };
  if (form === "VOLUNTEER" && amount !== 0) {
    return { form: fallbackForm, grosze: amount };
  }
  return { form, grosze: amount };
};

/**
 * What a fee costs the foundation, the server's `cost_for`: a volunteer costs
 * nothing, a mandate adds the employer's contributions once they are known.
 */
export const costGrosze = (
  pricing: Pricing,
  contributionsGrosze: number | null,
): number | null => {
  if (pricing.grosze === null) return null;
  if (pricing.form === "VOLUNTEER") return 0;
  if (pricing.form === "ZLECENIE" && contributionsGrosze !== null) {
    return pricing.grosze + contributionsGrosze;
  }
  return pricing.grosze;
};

const validRate = (
  rates: StandardRates,
  side: LedgerSide | null,
): number | null => {
  if (side === null) return null;
  const typed = rates[side];
  return typed === undefined ? null : toGrosze(typed);
};

export const samePricing = (left: Pricing, right: Pricing): boolean =>
  left.form === right.form && left.grosze === right.grosze;

const inputOf = (grosze: number | null): string =>
  grosze === null ? "" : toAmountInput(fromGrosze(grosze));

export const previewRow = (
  row: LedgerRowDTO,
  draft: RowDraft | undefined,
  rates: StandardRates,
): RowPreview => {
  const stored = storedPricing(row);
  const fallback = fallbackFormFor(row);
  const rate = takesStandardRate(row) ? validRate(rates, sideOf(row)) : null;

  const base =
    rate === null
      ? stored
      : reconcilePricing(stored, { grosze: rate }, fallback);

  if (!draft || !isPriceEditable(row)) {
    return {
      stored,
      base,
      next: base,
      amountInput: inputOf(base.grosze),
      isPending: !samePricing(base, stored),
      isInvalid: false,
    };
  }

  const typed = draft.amount;
  const typedGrosze = typed === undefined ? base.grosze : toGrosze(typed);
  const isInvalid = typed !== undefined && typed.trim() !== "" && typedGrosze === null;
  const next = isInvalid
    ? base
    : reconcilePricing(base, { form: draft.form, grosze: typedGrosze }, fallback);

  return {
    stored,
    base,
    next,
    // What was typed stays exactly as typed ("400." mid-keystroke); a form
    // change with nothing typed shows the amount it brings (volunteer → 0).
    amountInput: typed ?? inputOf(next.grosze),
    isPending: !samePricing(next, stored),
    isInvalid,
  };
};

/**
 * A typed amount on top of a row's draft. Typing an amount on a row whose
 * draft chose volunteer work is leaving it — the server would otherwise read
 * the pair as "volunteer" and throw the amount away.
 */
export const withAmount = (
  draft: RowDraft | undefined,
  amount: string,
): RowDraft => {
  const leavesVolunteer =
    draft?.form === "VOLUNTEER" && amount.trim() !== "" && toGrosze(amount) !== 0;
  return {
    amount,
    ...(draft?.form !== undefined && !leavesVolunteer ? { form: draft.form } : {}),
  };
};

/** A chosen form on top of a row's draft. Volunteer work brings its own 0. */
export const withForm = (
  draft: RowDraft | undefined,
  form: FeeForm,
): RowDraft => ({
  form,
  ...(draft?.amount !== undefined && form !== "VOLUNTEER" ? { amount: draft.amount } : {}),
});

/**
 * The budget as it will read once the draft is saved. A row that the draft
 * does not touch contributes the server's own cost; a paid row never changes.
 */
export const summarizeDraft = (
  rows: readonly LedgerRowDTO[],
  drafts: DraftMap,
  rates: StandardRates,
): DraftSummary => {
  let committed = 0;
  let unpriced = 0;
  let pending = 0;
  let invalid = 0;
  const byCategory = new Map<CostCategory, number>();

  for (const side of ["cast", "crew"] as const) {
    const typed = rates[side];
    if (typed !== undefined && toGrosze(typed) === null) invalid += 1;
  }

  for (const row of rows) {
    const preview = previewRow(row, drafts[row.key], rates);
    if (preview.isInvalid) invalid += 1;
    if (preview.isPending) pending += 1;

    let cost: number | null;
    if (preview.isPending) {
      const counted = preview.next.grosze !== null && (row.billable || row.is_paid);
      // A row the save changes carries no employer contributions after it
      // (`finance/services/ledger.py::_apply_pricing`): a mandate whose amount
      // moves drops the office's figure, which was computed on the old amount,
      // and a row that only becomes a mandate had none. It counts at its
      // amount until the office reports them again.
      cost = counted ? costGrosze(preview.next, null) : null;
    } else {
      cost = row.counted ? toGrosze(row.cost_amount) : null;
    }

    if (row.billable && preview.next.grosze === null) unpriced += 1;
    if (cost === null) continue;

    committed += cost;
    if (row.category !== "") {
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + cost);
    }
  }

  return { committed, byCategory, unpriced, pending, invalid };
};

export const feeRefOf = (row: LedgerRowDTO): FeeRef => {
  if (row.origin === "cast") return { participation: row.key };
  if (row.origin === "crew") return { crew_assignment: row.key };
  return { cost_item: row.key };
};

/**
 * The one request that saves the draft: the standard rates (the server applies
 * them first), then every row whose own edit changes it. A row's amount is
 * always sent — null clears it — and its form only when the edit named one.
 */
export const buildFeeBatch = (
  rows: readonly LedgerRowDTO[],
  drafts: DraftMap,
  rates: StandardRates,
): FeeBatchPayload => {
  const castRate = validRate(rates, "cast");
  const crewRate = validRate(rates, "crew");
  const items: FeeItemPayload[] = [];

  for (const row of rows) {
    const draft = drafts[row.key];
    if (!draft) continue;
    const preview = previewRow(row, draft, rates);
    if (preview.isInvalid || samePricing(preview.next, preview.base)) continue;

    const amount =
      draft.amount === undefined ? preview.base.grosze : toGrosze(draft.amount);
    items.push({
      ref: feeRefOf(row),
      contract_amount: amount === null ? null : fromGrosze(amount),
      ...(draft.form !== undefined ? { form: draft.form } : {}),
    });
  }

  const standardRate = {
    ...(castRate !== null ? { cast: fromGrosze(castRate) } : {}),
    ...(crewRate !== null ? { crew: fromGrosze(crewRate) } : {}),
  };

  return {
    ...(Object.keys(standardRate).length > 0 ? { standard_rate: standardRate } : {}),
    items,
  };
};

/** Rows a standard rate typed for `side` would reprice. */
export const repriceableCount = (
  rows: readonly LedgerRowDTO[],
  side: LedgerSide,
): number => rows.filter((row) => sideOf(row) === side && takesStandardRate(row)).length;
