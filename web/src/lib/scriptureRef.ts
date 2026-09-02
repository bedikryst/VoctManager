/**
 * @file scriptureRef.ts
 * @description Formats a concert's `inscriptioRef` — the citation under a Latin incipit — for one
 *  locale. The reference is stored STRUCTURALLY in `concerts.yaml` (book id + chapter + verses)
 *  rather than as the string "Iz 11, 1", because every visible part of that string is a language
 *  choice: the book abbreviation (Iz / Is / Is), the mark between chapter and verse (Polish and
 *  French set a comma, English a colon) and the mark between two verse groups (Polish a full stop,
 *  English a comma). Written as prose it would be translated by hand, once per locale, and drift.
 *
 *  A reference carries `scripture`, `source`, or both. `source` is for an incipit whose provenance
 *  is not a chapter and verse — an antiphon, an introit, a national prayer — and it IS copy, so it
 *  is held per locale like any other: "Introit Requiem" is "Requiem Introit" in English, while
 *  "Salve Regina" is a proper title and stays itself in all three.
 *
 *  The book table is a lexical fact rather than editorial copy, so it ships complete in all three
 *  locales; the abbreviations are the short forms a concert programme uses (Polish: the Millennium
 *  Bible's; French: the Bible de Jérusalem's), not the scholarly SBL set.
 * @architecture Astro islands 2026
 * @module lib/scriptureRef
 */
import { pickLocale, type Locale, type LocalizedText } from "../i18n/config";

/** The books cited across `concerts.yaml`. Add an entry here before citing a new one. */
export const SCRIPTURE_BOOKS = ["isa", "jer", "ps", "song", "matt", "luke", "zech"] as const;
export type ScriptureBook = (typeof SCRIPTURE_BOOKS)[number];

const ABBR: Record<ScriptureBook, Record<Locale, string>> = {
  isa: { pl: "Iz", en: "Is", fr: "Is" },
  jer: { pl: "Jr", en: "Jer", fr: "Jr" },
  ps: { pl: "Ps", en: "Ps", fr: "Ps" },
  song: { pl: "PnP", en: "Song", fr: "Ct" },
  matt: { pl: "Mt", en: "Mt", fr: "Mt" },
  luke: { pl: "Łk", en: "Lk", fr: "Lc" },
  zech: { pl: "Za", en: "Zech", fr: "Za" },
};

/** Chapter→verse mark, and the mark between two non-contiguous verse groups. */
const MARKS: Record<Locale, { verse: string; group: string }> = {
  pl: { verse: ", ", group: ". " },
  en: { verse: ":", group: ", " },
  fr: { verse: ", ", group: "." },
};

export interface ScriptureCite {
  readonly book: ScriptureBook;
  /** Chapter, as printed — a string because it is never arithmetic. */
  readonly chapter: string;
  /** Septuagint/Vulgate numbering, printed in parentheses after the chapter ("Ps 98 (97)"). */
  readonly chapterAlt?: string | undefined;
  /** Verse groups, each a single verse or an en-dashed range. Two groups where the citation
      skips ("Ps 84, 2–4. 7"); the mark between them is what differs per locale. */
  readonly verses?: readonly string[] | undefined;
}

export interface ScriptureRef {
  readonly scripture?: readonly ScriptureCite[] | undefined;
  readonly source?: LocalizedText | undefined;
}

const citeText = (cite: ScriptureCite, locale: Locale): string => {
  const marks = MARKS[locale];
  let out = `${ABBR[cite.book][locale]} ${cite.chapter}`;
  if (cite.chapterAlt) out += ` (${cite.chapterAlt})`;
  if (cite.verses && cite.verses.length > 0)
    out += marks.verse + cite.verses.join(marks.group);
  return out;
};

/** The whole reference on one line. Several citations, and a named source beside them, are
 *  joined by the interpunct the site already uses to seat two facts on one line. */
export function formatRef(ref: ScriptureRef, locale: Locale): string {
  const parts = (ref.scripture ?? []).map((cite) => citeText(cite, locale));
  if (ref.source) parts.push(pickLocale(ref.source, locale));
  return parts.join(" · ");
}
