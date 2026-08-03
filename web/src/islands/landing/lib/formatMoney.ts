/**
 * @file formatMoney.ts
 * @description Polish-locale currency formatter without fractional digits.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/formatMoney
 */

import { CURRENCY_SUFFIX, type GiveCurrency } from "../constants/giveTiers";

/* `useGrouping: "always"` is load-bearing, not a default restated. Polish CLDR data sets
   `minimumGroupingDigits: 2`, so the default groups only from five figures up: 2500 formats as
   "2500" while 20000 formats as "20 000". Every amount the coda's tiers can hand this — 500,
   2 500 — falls in that gap, and the vault would then contradict the page that opened it. */
const PL_MONEY = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});

export function formatMoney(amount: number, currency: GiveCurrency = "PLN"): string {
  const suffix = CURRENCY_SUFFIX[currency] ?? CURRENCY_SUFFIX.PLN;
  return `${PL_MONEY.format(Math.round(amount))} ${suffix}`;
}
