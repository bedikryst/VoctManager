/**
 * @file repertuar.ts
 * @description What each era of the repertoire catalogue is CALLED, in all three locales — the one
 *  translatable thing about `src/content/repertoire.yaml`, held apart from it because two surfaces
 *  print it: the catalogue on /koncerty#repertuar and the landing's litany plate.
 *
 *  WHY A TYPED RECORD AND NOT THE COPY DESK. The line the desk draws (spec §6r) is whether
 *  COMPLETENESS CAN BE DEMANDED. An era name is one word standing as a heading over a ruled band:
 *  a band whose head is missing in French is a broken page, not a page waiting for review — so it
 *  takes the shape a landmark takes, `Record<Locale, …>`, and adding an era without naming it in
 *  every locale is a failure rather than a fallback. Page PROSE is the opposite and lives in
 *  `src/content/pages/koncerty.yaml`, arriving one field at a time through the desk.
 *
 *  WHY IT IS NOT IN `repertoire.yaml`. It was, in Polish, and the catalogue is read by two pages —
 *  so translating it in place would have needed a locale map there, which is the shape §5 reserves
 *  for the vernacular of a foreign original. The catalogue now holds no copy at all: composers,
 *  works and datings, which are names and structure. That is the whole rule, and it is why the
 *  lookup below THROWS rather than falling back to the id — an unnamed era is a heading nobody
 *  wrote, and the build is the only place that can say so.
 *
 *  STILL OWED, named rather than buried: `works[].year` carries a Polish qualifier in twelve of
 *  the catalogue's datings ("ok. 1727", "pocz. XVI w.", "aranż. współczesna"), and those print
 *  Polish in every locale. The fix is structural — the treatment `inscriptioRef` got in stage A —
 *  not a translation, because a dating is never copy on this site.
 * @architecture Astro islands 2026
 * @module i18n/content/repertuar
 */

import type { Locale } from "../config";

export interface EraName {
  /** The band's heading, e.g. "Renesans". */
  readonly title: string;
  /** The centuries it spans, as the catalogue claims them, e.g. "XV–XVI w.". */
  readonly span: string;
}

/**
 * Keyed by the era's own `id` in `repertoire.yaml`. The spans are a claim about the COMPOSERS, not
 * about the oldest thing sung — `tradycja` names no century because an anonymous attribution has
 * no dates to span. The file's own header carries the arithmetic behind "seven centuries"; keep
 * the two in step.
 */
const ERAS: Record<Locale, Readonly<Record<string, EraName>>> = {
  pl: {
    renesans: { title: "Renesans", span: "XV–XVI w." },
    barok: { title: "Barok", span: "XVII – poł. XVIII w." },
    "klasycyzm-romantyzm": { title: "Klasycyzm i romantyzm", span: "XVIII – pocz. XX w." },
    wspolczesnosc: { title: "Współczesność", span: "XX–XXI w." },
    tradycja: { title: "Tradycja", span: "anonim · ludowe" },
  },
  en: {
    renesans: { title: "Renaissance", span: "15th–16th c." },
    barok: { title: "Baroque", span: "17th – mid-18th c." },
    "klasycyzm-romantyzm": { title: "Classical and Romantic", span: "18th – early 20th c." },
    wspolczesnosc: { title: "The modern era", span: "20th–21st c." },
    tradycja: { title: "Tradition", span: "anonymous · traditional" },
  },
  // French numbers a century with an ordinal, never a bare Roman numeral: `XVe s.`, not `XV s.`
  fr: {
    renesans: { title: "Renaissance", span: "XVe–XVIe s." },
    barok: { title: "Baroque", span: "XVIIe – mi-XVIIIe s." },
    "klasycyzm-romantyzm": { title: "Classicisme et romantisme", span: "XVIIIe – début XXe s." },
    wspolczesnosc: { title: "Époque contemporaine", span: "XXe–XXIe s." },
    tradycja: { title: "Tradition", span: "anonyme · traditionnel" },
  },
};

/** This era's heading and span in `locale`. Throws on an era nobody has named. */
export function eraName(id: string, locale: Locale): EraName {
  const name = ERAS[locale][id];
  if (!name) {
    throw new Error(
      `[repertuar] era "${id}" has no name in ${locale} — add it to src/i18n/content/repertuar.ts.`,
    );
  }
  return name;
}
