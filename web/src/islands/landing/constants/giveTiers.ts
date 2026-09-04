/**
 * @file giveTiers.ts
 * @description Donation tier configuration per currency, and the bounds the form validates
 *  against. The sentence describing which methods each currency supports is COPY and lives in
 *  `src/content/pages/skarbiec.yaml` — it is a claim a reader reads, not a constant.
 * @architecture Astro islands 2026
 * @module islands/landing/constants/giveTiers
 */

export type GiveCurrency = "PLN" | "EUR";

export const GIVE_TIERS: Readonly<Record<GiveCurrency, readonly number[]>> = {
  PLN: [50, 100, 200],
  EUR: [20, 50, 100],
};

/** The currency's mark, appended after the amount by `lib/formatMoney`. */
export const CURRENCY_SUFFIX: Readonly<Record<GiveCurrency, string>> = {
  PLN: "zł",
  EUR: "€",
};

export const GIVE_MIN = 1;
export const GIVE_MAX = 100000;
export const GIVE_DEFAULT_TIER = 1;
