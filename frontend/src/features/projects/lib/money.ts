/**
 * @file money.ts
 * @description Fee arithmetic and presentation for the budget ledger.
 * Amounts are always PLN and always Polish-formatted, regardless of interface
 * language: the figure is a sum of Polish invoices, and rendering it as
 * `6,750.00` for a French reader would misstate what is on the paperwork. Only
 * the labels around it translate.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/money
 */

const amountFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const preciseAmountFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A stored fee as a number. The API returns `DecimalField` as a string, and a
 * fee typed by hand may carry the Polish decimal comma.
 */
export const parseFee = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/** No price has been set. A fee of 0 is a decision; an empty field is not. */
export const hasNoFee = (
  value: string | number | null | undefined,
): boolean => parseFee(value) === null;

/** Grand totals and rails: `3 750`, `400,50` — decimals only when they exist. */
export const formatAmount = (value: number): string =>
  amountFormatter.format(value);

/** The ledger column, where figures align down the edge: always `400,00`. */
export const formatLedgerAmount = (value: number): string =>
  preciseAmountFormatter.format(value);

/**
 * Keeps a hand-typed fee to something the API will accept — digits, one
 * separator, two decimals — while the field is still `type="text"`. A native
 * number input was rejecting `400,50` outright on a Polish keyboard and
 * silently reporting an empty value for it.
 */
export const sanitizeAmountInput = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const [whole, ...rest] = cleaned.split(".");

  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
};

/** What a sanitized draft value sends to the API — `""` clears the fee. */
export const toFeePayload = (draftValue: string): number | null => {
  const parsed = parseFee(draftValue);
  return parsed === null ? null : parsed;
};
