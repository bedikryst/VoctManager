/**
 * @file horaeCanonicae.ts
 * @description Eight Benedictine canonical hours of the day, mapped to three-hour slices.
 * Used by the footer signal clock to label the current liturgical hour in Latin + Polish,
 * and by `scripts/landing.ts` to decide which of the footer's two palettes the page ends on.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/horaeCanonicae
 */

import type { Locale } from "../../../i18n/config";

/**
 * Which of the two grounds the page's last plate is printed on. It is a property of the OFFICE,
 * not of the sky: the hours' own glosses below claim the light ("świt wstępuje", "południe
 * gęstnieje", "światło opada") in six of eight and withhold it in two, so `lumen` reads the
 * table rather than adding anything to it.
 *
 * That distinction is the entry price for touching this footer at all. A solar day — real
 * sunrise and sunset over Kraków — was built into this footer three times and cut three times
 * (docs/web-landing-guardrails.md), and the outermost reason was that geodesy at a point is the
 * payload class of a weather widget while the canonical hours are a claim about how the house
 * keeps time. `lumen` stays on the near side of that line: it never asks where the sun is.
 *
 * Hence Vesperae is `dies` although 18:00 is full dark in a Kraków December — the light is
 * FALLING there, which is a different sentence from "night closes", and only the two hours
 * that say night take the night plate.
 */
export type Lumen = "dies" | "nox";

export interface CanonicalHour {
  readonly from: number;
  readonly name: string;
  /**
   * What the hour says beside its name, in the reader's own tongue — the antiphon's second half
   * in the mobile card, and the sentence `lumen` above is reading when it claims the light.
   *
   * Complete in three languages by the copy desk's own test (spec §6r): eight hours is a closed
   * table walked by the clock, so a missing locale is not a line awaiting review — it is a French
   * card printing Polish at whatever hour the reader happens to open it. Each is one clause,
   * present tense, subject first: the hour is doing something, not being described.
   */
  readonly poem: Record<Locale, string>;
  readonly lumen: Lumen;
}

export const HORAE_CANONICAE: readonly CanonicalHour[] = [
  {
    from: 0,
    name: "Matutinum",
    poem: { pl: "noc czuwa", en: "the night keeps watch", fr: "la nuit veille" },
    lumen: "nox",
  },
  {
    from: 3,
    name: "Laudes",
    poem: { pl: "świt wstępuje", en: "dawn ascends", fr: "l'aube monte" },
    lumen: "dies",
  },
  {
    from: 6,
    name: "Prima",
    poem: { pl: "dzień się otwiera", en: "the day opens", fr: "le jour s'ouvre" },
    lumen: "dies",
  },
  {
    from: 9,
    name: "Tertia",
    poem: { pl: "ranek dojrzewa", en: "the morning ripens", fr: "le matin mûrit" },
    lumen: "dies",
  },
  {
    from: 12,
    name: "Sexta",
    poem: { pl: "południe gęstnieje", en: "noon thickens", fr: "midi s'épaissit" },
    lumen: "dies",
  },
  {
    from: 15,
    name: "Nona",
    poem: { pl: "cień się wydłuża", en: "the shadow lengthens", fr: "l'ombre s'allonge" },
    lumen: "dies",
  },
  {
    from: 18,
    name: "Vesperae",
    poem: { pl: "światło opada", en: "the light falls", fr: "la lumière décline" },
    lumen: "dies",
  },
  {
    from: 21,
    name: "Completorium",
    poem: { pl: "noc się zamyka", en: "the night closes", fr: "la nuit se referme" },
    lumen: "nox",
  },
];

/** Length of one canonical slice, in hours. The table above is this constant, eight times. */
export const HORA_SPAN_HOURS = 3;

/* `hourCycle: "h23"` rather than `hour12: false` alone: the latter has resolved to the h24
   cycle on some ICU builds, which returns "24" just after midnight — and index 8 is off the
   end of the table below. */
const WARSAW_HOUR_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Warsaw",
});

export function horaForWarsaw(date: Date): CanonicalHour {
  const hour = parseInt(WARSAW_HOUR_FORMAT.format(date), 10);
  return HORAE_CANONICAE[Math.floor(hour / HORA_SPAN_HOURS)];
}

const WARSAW_HMS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Warsaw",
});

/**
 * How long until the office turns, so a page left open crosses into the next hour instead of
 * printing the one it was loaded in. `formatToParts` rather than parsing a formatted string:
 * the separator is the locale's, not ours.
 *
 * CAPPED, and the cap is the whole robustness story. The exact figure is arithmetic on Warsaw
 * wall-clock, which is a lie twice a year — on the March jump 01:59 computes an hour of slack
 * to a 03:00 that arrives in one second — and it is a lie again whenever a laptop is suspended
 * or a clock is corrected. Recomputing at least twice an hour means every one of those costs a
 * bounded lateness rather than a stuck plate, and the LAST wake before a boundary is still the
 * precise one, so the turn itself lands on the second.
 */
export function msToNextHora(date: Date, capMs = 30 * 60_000): number {
  const parts = WARSAW_HMS_FORMAT.formatToParts(date);
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);
  const intoSlice =
    (at("hour") % HORA_SPAN_HOURS) * 3600 + at("minute") * 60 + at("second");
  const exact = (HORA_SPAN_HOURS * 3600 - intoSlice) * 1000 - date.getMilliseconds();
  return Math.min(Math.max(exact, 1000), capMs);
}
