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
import { pickLocale, type Locale, type LocalizedText } from "../i18n/config";

const INTL_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB", fr: "fr-FR" };

/** Weekday-free long date from an ISO `YYYY-MM-DD` string. */
export const longDate = (iso: string, locale: Locale): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * Month and year only — the register ribbons' column ("sty 2024" / "Jan 2024" / "janv. 2024"),
 * where a full date has no room and the day is not the fact being stated.
 *
 * It replaces the hand-written `viaDate` the corpus used to carry, which was a Polish month in a
 * string and would have printed "sty 2024" in the chrome of every English concert page (the reason
 * `contract.mjs` files it under stage F). ICU reproduces the six hand-written Polish values
 * exactly; the two evenings whose day is genuinely vague have no `date` at all and state a
 * `dateLabel` instead, which is copy and per locale.
 */
export const shortDate = (iso: string, locale: Locale): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(INTL_LOCALE[locale], {
    month: "short",
    year: "numeric",
  });

/** The two fields an evening states its moment in: the ISO date where the day is known, and the
    per-locale `dateLabel` where it is genuinely vague. Both formatters below read exactly this,
    so a caller can hand either one a whole concert entry. */
type Moment = {
  readonly date?: string | undefined;
  readonly dateLabel?: LocalizedText | undefined;
};

/**
 * An evening's moment as the rails and registers abbreviate it — the derived replacement for the
 * hand-written `viaDate` the corpus used to carry.
 *
 * The field was a Polish month inside a string ("sty 2024"), which §7 of the copy-desk spec bans
 * outright and which would have printed Polish in the chrome of every English and French concert
 * page. ICU reproduces all four hand-written values exactly, so this is the one place the
 * abbreviation is composed. An evening whose day is genuinely vague has no `date` and states a
 * `dateLabel` instead — that one IS copy, and a surface holding the concert's id should resolve it
 * through the copy overlay rather than taking the corpus's Polish (lib/registrum does).
 */
export const viaMoment = (moment: Moment, locale: Locale): string =>
  moment.date
    ? shortDate(moment.date, locale)
    : moment.dateLabel
      ? pickLocale(moment.dateLabel, locale)
      : "";

/**
 * The same moment written out in full — for a surface with room for the day, and for the one that
 * must not disagree with its neighbour.
 *
 * It exists because the landing states this evening TWICE: the hero's announcement above the fold
 * and the Proximum band far below it. The band formats `longDate`, the announcement used to reach
 * for `viaMoment`, and the page therefore printed "paź 2026" and "11 października 2026" for one
 * date — with the abbreviation, which belongs to the register ribbons' narrow column, appearing
 * nowhere else on the page that borrowed it. Reach for `viaMoment` where the column is narrow and
 * for this where the line is a sentence; the fallback to `dateLabel` is the same in both, so an
 * evening whose day is genuinely vague still states its season rather than a fabricated day.
 */
export const longMoment = (moment: Moment, locale: Locale): string =>
  moment.date
    ? longDate(moment.date, locale)
    : moment.dateLabel
      ? pickLocale(moment.dateLabel, locale)
      : "";

/** Descending value/glyph pairs — enough for any year this site will print. */
const ROMAN: readonly (readonly [number, string])[] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/**
 * A number in roman numerals. Two surfaces read it and both want it locale-neutral: the landing
 * dates an evening by its year ("MMXXIV"), which is half the reason it dates in roman at all, and
 * the cycle numbers its stations from their position (`lib/cycle`).
 */
export function romanNumeral(value: number): string {
  let rest = value;
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/**
 * A photograph's night as the Imagines band prints it — "styczeń MMXXIV" / "January MMXXIV" /
 * "janvier MMXXIV". The month is formatted per locale from an ISO `YYYY-MM`; the year stays roman
 * because that is the register's voice and the band's numerals answer the register's.
 *
 * It replaces a hand-written `frameDate` that carried a Polish month inside a data string, which
 * is the fault §5 of the copy-desk spec bans outright: it would have printed "styczeń" under the
 * English plate with nothing anywhere reporting an error.
 */
export const photographMoment = (isoMonth: string, locale: Locale): string => {
  const month = new Date(`${isoMonth}-01T00:00:00`).toLocaleDateString(INTL_LOCALE[locale], {
    month: "long",
  });
  return `${month} ${romanNumeral(Number(isoMonth.slice(0, 4)))}`;
};
