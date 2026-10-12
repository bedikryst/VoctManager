/**
 * @file programmeLine.ts
 * @description One work of a concert's programme as a page in `locale` prints it. Every surface
 *  that lists a programme (the concert page, /koncerty, the landing's register) reads it through
 *  here, so a line cannot be English on one page and Polish on the next.
 *
 *  Two doors meet in one line. The work's title is copy, read from the overlay under
 *  `program.<i>.workHtml` (and `ritornello.workHtml`); the composer, the dates and the scoring are
 *  names and conventions, rendered by `lib/programmeTerms`.
 *
 *  `index` is the work's position in the corpus's `program` list, which is what its desk key is
 *  built from. Map BEFORE filtering (an encore withheld, a ritornello row added), or every key after
 *  the gap reads its neighbour's title.
 *
 *  Build-time only: it reads the overlays through `lib/copyOverlay`.
 * @architecture Astro islands 2026
 * @module lib/programmeLine
 */

import type { CollectionEntry } from "astro:content";

import type { Locale } from "../i18n/config";
import { concertKey, withOverlay } from "./copyOverlay";
import { attribution, dating, lifeDates, scoring } from "./programmeTerms";

type Concert = CollectionEntry<"concerts">["data"];
type ProgramItem = Concert["program"][number];
type Ritornello = NonNullable<Concert["ritornello"]>;

export interface ProgrammeLine {
  readonly composer: string;
  readonly years?: string;
  /** Markup: a title may italicise a foreign name inside a vernacular phrase. */
  readonly work: string;
  readonly year?: string;
  readonly voicing?: string;
}

/** The `index`-th work of concert `concertId` in `locale`. */
export function programmeLine(concertId: string, index: number, item: ProgramItem, locale: Locale): ProgrammeLine {
  return {
    composer: attribution(item.composer, locale),
    years: item.years === undefined ? undefined : lifeDates(item.years, item.composer, locale),
    work: withOverlay(concertKey(concertId, `program.${index}.workHtml`), locale, item.work),
    year: item.year === undefined ? undefined : dating(item.year, locale),
    voicing: item.voicing === undefined ? undefined : scoring(item.voicing, locale),
  };
}

/** The piece an evening keeps returning to, in `locale`. */
export function ritornelloLine(concertId: string, ritornello: Ritornello, locale: Locale): ProgrammeLine {
  return {
    composer: attribution(ritornello.composer, locale),
    years:
      ritornello.years === undefined ? undefined : lifeDates(ritornello.years, ritornello.composer, locale),
    work: withOverlay(concertKey(concertId, "ritornello.workHtml"), locale, ritornello.work),
    year: ritornello.year === undefined ? undefined : dating(ritornello.year, locale),
  };
}
