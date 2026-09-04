/**
 * @file formatMoney.ts
 * @description An amount as this site prints it: the number in the reader's own convention, then
 *  the currency's sign.
 * @architecture Astro islands 2026
 * @module islands/landing/lib/formatMoney
 */

import { DEFAULT_LOCALE, type Locale } from "../../../i18n/config";
import { CURRENCY_SUFFIX, type GiveCurrency } from "../constants/giveTiers";

/* The number, not the currency. `Intl`'s currency style would also decide the SIGN and its side —
   "PLN 100" in English, "€100" before the digits — and the vault's whole typographic shape is an
   amount followed by its mark. So the formatter is asked for the digits only and the suffix is
   appended, which leaves exactly one thing per locale to get right: the group separator, which is
   a no-break space in Polish, a narrow one in French and a comma in English.

   `useGrouping: "always"` is load-bearing, not a default restated. Polish CLDR data sets
   `minimumGroupingDigits: 2`, so the default groups only from five figures up: 2500 formats as
   "2500" while 20000 formats as "20 000". Every amount the coda's tiers can hand this — 500,
   2 500 — falls in that gap, and the vault would then contradict the page that opened it. */
const NUMBER: Record<Locale, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0, useGrouping: "always" }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0, useGrouping: "always" }),
  fr: new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, useGrouping: "always" }),
};

export function formatMoney(
  amount: number,
  currency: GiveCurrency = "PLN",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const suffix = CURRENCY_SUFFIX[currency] ?? CURRENCY_SUFFIX.PLN;
  return `${NUMBER[locale].format(Math.round(amount))} ${suffix}`;
}
