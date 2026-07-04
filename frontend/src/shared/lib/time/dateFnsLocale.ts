/**
 * @file dateFnsLocale.ts
 * @description Maps the active i18next language to a date-fns `Locale`, so the
 * relative-date helpers (`formatDistanceToNow`, …) render in the user's language
 * instead of always defaulting to English. Falls back to Polish — the app's
 * primary locale — for anything unrecognised.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/time
 */

import type { Locale } from "date-fns";
import { enUS, fr, pl } from "date-fns/locale";

import i18n from "@/shared/config/i18n";

const LOCALES: Record<string, Locale> = { pl, en: enUS, fr };

/**
 * The date-fns `Locale` for a language code (or the active i18n language when
 * omitted). Normalises region-tagged codes (`pl-PL` → `pl`) and defaults to
 * Polish.
 */
export const getDateFnsLocale = (language?: string): Locale => {
  const base = (
    language ??
    i18n.resolvedLanguage ??
    i18n.language ??
    "pl"
  ).split("-")[0];
  return LOCALES[base] ?? pl;
};
