/**
 * @file money.ts
 * @description Money on the client: parsing, the integer-grosze arithmetic of a
 * draft preview, and presentation.
 * Two rules hold everywhere in the panel:
 *  - no float addition on money. The server sums everything persisted in
 *    `Decimal`; the one sum the client computes — a draft not yet saved — runs
 *    in integer grosze, parsed from the decimal string digit by digit, so
 *    `0.1 + 0.2` can never print a grosz that was never paid.
 *  - amounts are always PLN and always Polish-formatted, whatever the interface
 *    language: the figure is a sum of Polish paperwork, and `6,750.00` for a
 *    French reader would misstate what is on it. Only the labels translate.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/money
 */

import type { DecimalString } from "../types/finance.dto";

const GROSZE_PER_ZLOTY = 100;

const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{0,2}))?$/;

const amountFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const preciseAmountFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * An amount as integer grosze: `"1250.00"` → 125000, `"400,5"` → 40050.
 * Accepts what the API writes and what a hand in a Polish keyboard types
 * (a decimal comma, spaces between groups). `null` for empty or anything that
 * is not a non-negative amount with at most two decimals — never a guess.
 */
export const toGrosze = (
  value: DecimalString | null | undefined,
): number | null => {
  if (value === null || value === undefined) return null;

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) return null;

  const [, whole, fraction = ""] = match;
  const grosze =
    Number(whole) * GROSZE_PER_ZLOTY + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(grosze) ? grosze : null;
};

/**
 * A plan line's preview: quantity × unit cost in grosze, rounded half up as the
 * server rounds it. Both factors come as typed or stored decimals with at most
 * two places; the product runs in BigInt, because two ten-digit factors
 * overflow a float's exact range long before they overflow a budget.
 * `null` when either factor is not an amount.
 */
export const lineTotalGrosze = (
  quantity: DecimalString,
  unitCost: DecimalString,
): bigint | null => {
  const hundredths = toGrosze(quantity);
  const grosze = toGrosze(unitCost);
  if (hundredths === null || grosze === null) return null;
  return (BigInt(hundredths) * BigInt(grosze) + 50n) / 100n;
};

/** The largest amount the server stores: 99 999 999,99 zł. */
export const MAX_AMOUNT_GROSZE = 9_999_999_999n;

/** Integer grosze back to the API's decimal string: 40050 → `"400.50"`. */
export const fromGrosze = (grosze: number): DecimalString => {
  const whole = Math.trunc(grosze / GROSZE_PER_ZLOTY);
  const fraction = grosze % GROSZE_PER_ZLOTY;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
};

/** Rails and headlines: `3 750`, `400,5` — decimals only when they exist. */
export const formatGrosze = (grosze: number): string =>
  amountFormatter.format(grosze / GROSZE_PER_ZLOTY);

/** A column of figures, where amounts align down the edge: always `400,00`. */
export const formatLedgerGrosze = (grosze: number): string =>
  preciseAmountFormatter.format(grosze / GROSZE_PER_ZLOTY);

/** A server amount for a rail; `null` reads as nothing to state. */
export const formatAmount = (value: DecimalString | null): string | null => {
  const grosze = toGrosze(value);
  return grosze === null ? null : formatGrosze(grosze);
};

/** A server amount for a ledger column. */
export const formatLedgerAmount = (
  value: DecimalString | null,
): string | null => {
  const grosze = toGrosze(value);
  return grosze === null ? null : formatLedgerGrosze(grosze);
};

/** Whether a server amount is above zero — a figure worth a slot at all. */
export const isPositiveAmount = (value: DecimalString | null): boolean =>
  (toGrosze(value) ?? 0) > 0;

/**
 * Keeps a hand-typed amount to something the API will accept — digits, one
 * separator, two decimals — while the field stays `type="text"`. A native
 * number input rejects `400,50` on a Polish keyboard and silently reports an
 * empty value for it.
 */
export const sanitizeAmountInput = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const [whole, ...rest] = cleaned.split(".");

  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
};

/**
 * A stored amount as a field shows it: `"1250.00"` → `"1250"`,
 * `"400.50"` → `"400.5"`. Empty for no amount.
 */
export const toAmountInput = (value: DecimalString | null): string => {
  const grosze = toGrosze(value);
  if (grosze === null) return "";
  const whole = Math.trunc(grosze / GROSZE_PER_ZLOTY);
  const fraction = grosze % GROSZE_PER_ZLOTY;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
};
