/**
 * @file dates.ts
 * @description The site's one long-date formatter — "20 stycznia 2024" / "20 January 2024" /
 *  "20 janvier 2024". Weekday-free, day-first in every locale, which is the register the concert
 *  pages print (hero dateline, tour itinerary, gallery run heads).
 *
 *  IT EXISTS BECAUSE A DATE MUST NEVER BE WRITTEN INTO COPY. `concerts.yaml` used to carry
 *  "Bazylika NSPJ, Kraków · 20 stycznia 2024" as one editable string, so translating the line
 *  carried a Polish-formatted date into English and detached it from the structured `date` field
 *  it was supposed to restate. The place is copy and is held per locale; the date is data and is
 *  formatted from the ISO value here.
 *
 *  Two things the ICU output is trusted for and one it is not: Polish and French month names come
 *  back LOWERCASE and English capitalized, which is correct in all three, and `en-GB` gives
 *  "20 January" rather than the American "January 20" — matching `LOCALE_META.en.ogLocale`. What
 *  it must not be handed is a bare `new Date(iso)`, which parses an ISO date as UTC midnight and
 *  in a positive-offset build zone prints the day before; the `T00:00:00` suffix makes it local.
 * @architecture Astro islands 2026
 * @module lib/dates
 */
import type { Locale } from "../i18n/config";

const INTL_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB", fr: "fr-FR" };

/** Weekday-free long date from an ISO `YYYY-MM-DD` string. */
export const longDate = (iso: string, locale: Locale): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
