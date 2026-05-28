/**
 * @file formatMoney.ts
 * @description Polish-locale currency formatter without fractional digits.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/formatMoney
 */

import { CURRENCY_SUFFIX, type GiveCurrency } from "../constants/giveTiers";

const PL_MONEY = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

export function formatMoney(amount: number, currency: GiveCurrency = "PLN"): string {
  const suffix = CURRENCY_SUFFIX[currency] ?? CURRENCY_SUFFIX.PLN;
  return `${PL_MONEY.format(Math.round(amount))} ${suffix}`;
}
