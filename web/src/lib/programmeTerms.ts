/**
 * @file programmeTerms.ts
 * @description The house's own words inside a programme line, in each locale: the life dates
 *  ("ur. 1935"), the dating ("ok. 1638", "XVI w.", "oprac. Paul Drayton 2019"), the scoring
 *  ("skrzypce i organy") and an attribution standing where a composer would ("Anonim / aranż.
 *  Brian Kay", the Polish spelling of a foreign name). The corpus writes them in Polish, as its
 *  editors do; this module prints them in English and French.
 *
 *  NOT COPY, ON PURPOSE. A dating is never copy on this site (docs/specs/web-copy-desk-2026-09.md,
 *  the rule that made `viaDate` and `inscriptioRef` structural): "ok." is a convention with one
 *  rendering per locale, and putting it on the desk would hand Florent a formatting convention to
 *  review a hundred times. Names stay names. What this module knows is a CLOSED vocabulary, and
 *  anything outside it that carries a word throws, so a new Polish qualifier fails the build
 *  instead of printing Polish on an English page.
 *
 *  The work's title is the one part of the line that is copy (`program[].workHtml` on the desk):
 *  a title in a vernacular phrase is prose, and Florent may well word it otherwise.
 *
 *  Pure and import-free, so `node --test` runs it against both corpora (copydesk/programmeTerms.test.mjs).
 * @architecture Astro islands 2026
 * @module lib/programmeTerms
 */

import type { Locale } from "../i18n/config";

type Rendering = { readonly en: string; readonly fr: string };

/** Polish words of a scoring segment, whole (word order differs: "skrzypce solo" / "solo violin"). */
const SCORING: Readonly<Record<string, Rendering>> = {
  kwartet: { en: "quartet", fr: "quatuor" },
  wiolonczela: { en: "cello", fr: "violoncelle" },
  organy: { en: "organ", fr: "orgue" },
  "dwa chóry": { en: "two choirs", fr: "double chœur" },
  "chór a 5 i soliści a 4": { en: "choir a 5 and soloists a 4", fr: "chœur a 5 et solistes a 4" },
  "skrzypce solo": { en: "solo violin", fr: "violon seul" },
  "skrzypce i chór": { en: "violin and choir", fr: "violon et chœur" },
  "skrzypce i chór a 12": { en: "violin and choir a 12", fr: "violon et chœur a 12" },
  "skrzypce i organy": { en: "violin and organ", fr: "violon et orgue" },
};

/**
 * What stands in a composer's place without being a name, and the foreign names Polish spells its
 * own way. Every other composer prints as written.
 */
const ATTRIBUTION: Readonly<Record<string, Rendering>> = {
  Anonim: { en: "Anonymous", fr: "Anonyme" },
  tradycyjne: { en: "traditional", fr: "traditionnel" },
  "tradycja Oksytanii": { en: "Occitan tradition", fr: "tradition occitane" },
  "Polifonia korsykańska": { en: "Corsican polyphony", fr: "Polyphonie corse" },
  "Siergiej Rachmaninow": { en: "Sergei Rachmaninoff", fr: "Sergueï Rachmaninov" },
  "Rachmaninow, Siergiej": { en: "Rachmaninoff, Sergei", fr: "Rachmaninov, Sergueï" },
  "Händel, George Frideric": { en: "Handel, George Frideric", fr: "Haendel, Georg Friedrich" },
};

/** Whole dating segments that are neither a year nor a qualified year. */
const DATING: Readonly<Record<string, Rendering>> = {
  "aranż. współczesna": { en: "contemporary arr.", fr: "arr. contemporain" },
  "trad. Oksytania": { en: "Occitan trad.", fr: "trad. occitane" },
  "polifonia korsykańska": { en: "Corsican polyphony", fr: "polyphonie corse" },
};

/** Proper names that stand in a dating's place: the source, not a date. Printed as written. */
const DATING_NAMES: ReadonlySet<string> = new Set(["Llibre Vermell"]);

/**
 * French agrees "né" with the composer, and the corpus records no gender: the living women among
 * the composers are named here. One missing prints "né en" under her name.
 */
const FEMININE: ReadonlySet<string> = new Set(["Caroline Shaw", "Shaw, Caroline"]);

const YEARS = String.raw`\d{4}(?:[–/]\d{2,4})?`;

function fail(kind: string, value: string): never {
  throw new Error(
    `[programme] "${value}" in a ${kind} is not a known term. Add it to src/lib/programmeTerms.ts ` +
      "in English and French, or write the corpus value in a form the module reads.",
  );
}

function romanValue(roman: string): number {
  const digits: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const value = digits[roman[i]];
    const next = digits[roman[i + 1]] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

function englishOrdinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "XVI w." / "pocz. XVI w." in the target locale, or `null` when `text` is not a century. */
function century(text: string, locale: "en" | "fr"): string | null {
  const match = /^(pocz\. )?([IVXL]+) w\.$/u.exec(text);
  if (!match) return null;
  const early = Boolean(match[1]);
  if (locale === "en") return `${early ? "early " : ""}${englishOrdinal(romanValue(match[2]))} c.`;
  return `${early ? "début du " : ""}${match[2]}e s.`;
}

/** One dating segment: a year, a qualified year, a century, an arranger, a named source. */
function datingSegment(segment: string, locale: "en" | "fr"): string {
  if (new RegExp(`^${YEARS}$`, "u").test(segment)) return segment;
  if (DATING_NAMES.has(segment)) return segment;
  const whole = DATING[segment];
  if (whole) return whole[locale];

  const asCentury = century(segment, locale);
  if (asCentury) return asCentury;

  const circa = new RegExp(`^ok\\. (${YEARS})$`, "u").exec(segment);
  if (circa) return `${locale === "en" ? "c." : "vers"} ${circa[1]}`;
  const before = new RegExp(`^przed (${YEARS})$`, "u").exec(segment);
  if (before) return `${locale === "en" ? "before" : "avant"} ${before[1]}`;
  const revised = new RegExp(`^re[wv]\\. (${YEARS})$`, "u").exec(segment);
  if (revised) return `${locale === "en" ? "rev." : "rév."} ${revised[1]}`;
  // An arranger's name, optionally with the year of the arrangement.
  const arranged = /^(?:oprac|aranż)\. (.+)$/u.exec(segment);
  if (arranged) return `arr. ${arranged[1]}`;
  return fail("dating", segment);
}

/** Split on the corpus's two separators, keeping them, and render each segment. */
function bySegments(value: string, separators: RegExp, render: (segment: string) => string): string {
  return value
    .split(separators)
    .map((part, i) => (i % 2 === 1 ? part : render(part)))
    .join("");
}

/** When the work was written: "ok. 1638" → "c. 1638" / "vers 1638". */
export function dating(value: string, locale: Locale): string {
  if (locale === "pl") {
    datingSegments(value, "en");
    return value;
  }
  return datingSegments(value, locale);
}

function datingSegments(value: string, locale: "en" | "fr"): string {
  return bySegments(value, /( · | \/ )/u, (segment) => datingSegment(segment, locale));
}

/** A composer's dates: "ur. 1935" → "b. 1935" / "né en 1935"; a plain span prints as written. */
export function lifeDates(value: string, composer: string, locale: Locale): string {
  const rendered = (target: "en" | "fr"): string => {
    if (new RegExp(`^${YEARS}$`, "u").test(value)) return value;
    const born = /^ur\. (\d{4})$/u.exec(value);
    if (born) {
      if (target === "en") return `b. ${born[1]}`;
      return `${FEMININE.has(composer) ? "née" : "né"} en ${born[1]}`;
    }
    const circa = new RegExp(`^ok\\. (${YEARS})$`, "u").exec(value);
    if (circa) return `${target === "en" ? "c." : "vers"} ${circa[1]}`;
    return fail("composer's dates", value);
  };
  if (locale === "pl") {
    rendered("en");
    return value;
  }
  return rendered(locale);
}

/** The forces: "a 8", "SATB" and voice counts print as written; the instruments are words. */
export function scoring(value: string, locale: Locale): string {
  const segment = (part: string, target: "en" | "fr"): string => {
    if (/^a \d+(?:\/\d+)?$/u.test(part) || /^[SATB]+$/u.test(part)) return part;
    return SCORING[part]?.[target] ?? fail("scoring", part);
  };
  if (locale === "pl") {
    bySegments(value, /( · | \+ )/u, (part) => segment(part, "en"));
    return value;
  }
  return bySegments(value, /( · | \+ )/u, (part) => segment(part, locale));
}

/**
 * The composer as the locale names them: an attribution in words ("Anonim / aranż. Brian Kay") or
 * a name Polish spells its own way. A name with nothing to translate prints as written.
 */
export function attribution(value: string, locale: Locale): string {
  if (locale === "pl") return value;
  const whole = ATTRIBUTION[value];
  if (whole) return whole[locale];
  return bySegments(value, /( \/ )/u, (part) => {
    const known = ATTRIBUTION[part];
    if (known) return known[locale];
    const arranged = /^aranż\. (.+)$/u.exec(part);
    return arranged ? `arr. ${arranged[1]}` : part;
  });
}
