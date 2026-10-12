/**
 * @file giveTiers.ts
 * @description Donation tier configuration per currency, and the bounds the form validates
 *  against. The sentence describing which methods each currency supports is COPY and lives in
 *  `src/content/pages/skarbiec.yaml` — it is a claim a reader reads, not a constant.
 * @module islands/landing/constants/giveTiers
 */

import type { Locale } from "../../../i18n/config";

export type GiveCurrency = "PLN" | "EUR";

export const GIVE_TIERS: Readonly<Record<GiveCurrency, readonly number[]>> = {
  PLN: [50, 100, 200],
  EUR: [20, 50, 100],
};

/**
 * The currency's mark, appended after the amount by `lib/formatMoney`. A Polish reader knows the
 * złoty as "zł"; an English or French donor reads the ISO code, which is also what the site's own
 * English and French copy writes ("approx. PLN 28,000", "environ 28 000 PLN").
 */
export const CURRENCY_MARK: Readonly<Record<GiveCurrency, Readonly<Record<Locale, string>>>> = {
  PLN: { pl: "zł", en: "PLN", fr: "PLN" },
  EUR: { pl: "€", en: "€", fr: "€" },
};

export const GIVE_MIN = 1;
export const GIVE_MAX = 100000;
export const GIVE_DEFAULT_TIER = 1;
