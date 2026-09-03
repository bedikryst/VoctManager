/**
 * @file localeView.ts
 * @description The locale switch: which languages of a page are on screen at
 * once. Four views, and Polish is in every one of them.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/localeView
 */

import type { SiteLocale } from "../types/copydesk.dto";

export type LocaleViewId = "pl" | "pl-en" | "pl-fr" | "all";

/**
 * Polish appears in every view because it is the SOURCE, not a column like the
 * others: a translation is the rendering of a Polish sense, so an English cell
 * with its Polish off screen is a paragraph the editor cannot check. That also
 * settles what the "original under a toggle" is — the value the repository
 * holds for THIS cell, never the Polish, which is already beside it.
 *
 * Three columns are deliberately one of the four rather than the default: on a
 * laptop, a `note` runs to several hundred words and three columns of it are
 * three narrow ribbons.
 */
export const LOCALE_VIEWS: Readonly<Record<LocaleViewId, readonly SiteLocale[]>> = {
  pl: ["pl"],
  "pl-en": ["pl", "en"],
  "pl-fr": ["pl", "fr"],
  all: ["pl", "en", "fr"],
};

export const LOCALE_VIEW_ORDER: readonly LocaleViewId[] = [
  "pl",
  "pl-en",
  "pl-fr",
  "all",
];

/** Short, in the language itself — a column marker, not a sentence. */
export const LOCALE_MARKS: Readonly<Record<SiteLocale, string>> = {
  pl: "PL",
  en: "EN",
  fr: "FR",
};
