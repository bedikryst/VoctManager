/**
 * @file noticeRegister.ts
 * @description The evenings /newsletter sets beside its sign-up: the one still ahead, and the
 *  record of those already sung. Derived from the concert corpus, never written into copy.
 *
 *  WHY THE PAGE CARRIES A REGISTER AT ALL. A sign-up asks for an address in exchange for a
 *  promise, and the promise on this list is "one letter before each evening". The record is what
 *  makes that promise checkable: six evenings between January 2024 and October 2026 states the
 *  cadence more exactly than any sentence would, and it states it in the corpus's own words rather
 *  than in a claim the page makes about itself. It is also the one content on this page that
 *  cannot go stale — it grows.
 *
 *  A RECORD, NOT A FORECAST, AND THAT IS THE LOAD-BEARING CHOICE. An index of evenings still ahead
 *  is a list of ONE for most of any year — the corpus holds a single future station at a time —
 *  and a shelf with one thing on it reads worse than an empty column. Counting backwards instead
 *  gives a list that is never short, and the evening still ahead keeps a place of its own at the
 *  head of it.
 *
 *  STATIONS ONLY, for the reason `lib/cycle` states and `/nuntius` repeats: the ensemble also sings
 *  liturgies and weddings, and this list promises Spiritual Concerts. `cycle: false` in the corpus
 *  is what holds those out.
 *
 *  AN EVENING WITHOUT A `date` IS PAST, NOT MISSING. Two of them state a vague moment instead
 *  ("jesień 2025", "2024"), which is copy and lives in the overlay; they cannot be compared against
 *  a clock, and every one of them has already happened. So the test for "ahead" is a dated evening
 *  dated today or later, and everything else falls to the record — where the vague moment is
 *  exactly what the column wants to print.
 * @architecture Astro islands 2026
 * @module lib/noticeRegister
 */
import { concertKey, withOverlay } from "./copyOverlay";
import { cycleNumerals, cycleStations } from "./cycle";
import { longMoment, viaMoment } from "./dates";
import type { Locale, LocalizedText } from "../i18n/config";

/** The slice of a `concerts` entry this module reads — structural, like lib/registrum's. */
export interface RegisterStation {
  readonly id: string;
  readonly data: {
    readonly order: number;
    readonly cycle: boolean;
    readonly latin: string;
    readonly title: string;
    readonly hasPage: boolean;
    readonly venue?: string;
    readonly venueNote?: string;
    readonly date?: string;
    readonly time?: string;
    readonly endTime?: string;
    readonly inscriptio?: string;
    readonly inscriptioGloss?: LocalizedText;
    readonly dateLabel?: LocalizedText;
    readonly about?: { readonly place?: string; readonly blurb?: string };
  };
}

/** One line of the register — the markup renders this verbatim and derives nothing further. */
export interface RegisterEvening {
  readonly id: string;
  readonly href: string;
  /** The cycle's own numeral, counted over the stations (lib/cycle). */
  readonly roman: string;
  readonly latin: string;
  readonly title: string;
  /** The short place the register ribbons print — "Bazylika NSPJ · Kraków". */
  readonly place: string;
  /** Abbreviated, for the record's narrow column: "sty 2024". */
  readonly moment: string;
  /** Written out, for the evening that gets a line of its own: "11 października 2026". */
  readonly fullMoment: string;
  /**
   * The hour, where the corpus states one. Only the evening still ahead prints it: an hour is
   * something a reader acts on, and beside an evening already sung it is a fact about nothing.
   */
  readonly time: string | undefined;
  /**
   * The end of the SLOT where the organiser published one — never a duration of ours. Printed as
   * the far side of a window ("13:30–14:30") beside `time`, and only for the evening ahead.
   */
  readonly endTime: string | undefined;
  /** Which room, in a building that has two. Empty where the corpus names none. */
  readonly venueNote: string;
  /**
   * The evening's inscription, in its own language, and its vernacular rendering. This is the one
   * line on the letter that no other ensemble could print — what will be sung, quoted as the
   * letter quotes it — so where the corpus states none the letter simply has no quotation.
   */
  readonly inscriptio: string;
  readonly inscriptioGloss: string;
  /** The evening's programme, where it has a page: the letter's one link out of itself. */
  readonly programHref: string;
  /**
   * The evening's own sentence (`about.blurb`), copy and translated through the overlay. Carried
   * for every entry and spent only by the one still ahead: five of them down the index would be a
   * wall of prose where a reader wants a list, and the argument for an address is made once.
   */
  readonly blurb: string;
}

export interface NoticeRegisterData {
  /** The evening the next letter will be about, where there is one. */
  readonly ahead: RegisterEvening | undefined;
  /** Everything already sung, most recent first. */
  readonly record: readonly RegisterEvening[];
}

/**
 * The register, in `locale`, against `today` (an ISO `YYYY-MM-DD` in the site's own timezone).
 *
 * `concertsHref` is the caller's already-localized `/koncerty` path, on the rule `lib/registrum`
 * sets: only the caller knows which concerts are translated, so the localizing stays there and
 * this module composes paths beneath whatever it is handed. An evening with no page of its own is
 * still a PLACE on the walk, so it links to its anchor rather than to nothing.
 */
export const noticeRegister = (
  concerts: readonly RegisterStation[],
  locale: Locale,
  today: string,
  concertsHref: string,
): NoticeRegisterData => {
  // Resolved over the WHOLE corpus before anything is filtered out, so an evening this page does
  // not print cannot shift the numerals of the ones it does.
  const numerals = cycleNumerals(concerts);
  // Taken once and read twice below: the split into "ahead" and "record" is an index into THIS
  // ordering, so a second call — which sorts and filters again — would be a second chance for the
  // two halves to disagree about which evening sits where.
  const stations = cycleStations(concerts);

  const evenings = stations.map((entry): RegisterEvening => {
    const say = (field: string, polish: string): string =>
      withOverlay(concertKey(entry.id, field), locale, polish);
    // One expression for both kinds of evening, as lib/registrum documents: a dated one formats
    // its ISO value and holds no `dateLabel` key in the overlay, so the lookup misses and the
    // formatted date stands; a vague one states copy, and the overlay is where it is translated.
    const moment = say("dateLabel", viaMoment(entry.data, locale));
    const place = entry.data.about?.place
      ? say("about.place", entry.data.about.place)
      : (entry.data.venue ?? "");
    const href = entry.data.hasPage
      ? `${concertsHref}/${entry.id}`
      : `${concertsHref}#${entry.id}`;
    return {
      id: entry.id,
      href,
      /* The band `#program` is the page's own anchor; an evening with no page of its own has
         nothing to open, so the link falls back to its place on the walk. */
      programHref: entry.data.hasPage ? `${href}#program` : href,
      roman: numerals.get(entry.id) ?? "",
      latin: entry.data.latin,
      title: say("title", entry.data.title),
      place,
      venueNote: entry.data.venueNote ? say("venueNote", entry.data.venueNote) : "",
      moment,
      fullMoment: say("dateLabel", longMoment(entry.data, locale)),
      time: entry.data.time,
      endTime: entry.data.endTime,
      /* The original is content, not language: printed unchanged in every locale, with the
         vernacular beneath it (`content.config.ts`, rule 1). */
      inscriptio: entry.data.inscriptio ?? "",
      inscriptioGloss: entry.data.inscriptioGloss?.pl
        ? say("inscriptioGloss", entry.data.inscriptioGloss.pl)
        : "",
      blurb: entry.data.about?.blurb ? say("about.blurb", entry.data.about.blurb) : "",
    };
  });

  // The soonest station dated today or later. `order` is the chronology, so the FIRST match in
  // this ordering is that evening; a dateless one states a vague moment and has already happened.
  const aheadAt = stations.findIndex(
    (entry) => entry.data.date !== undefined && entry.data.date >= today,
  );

  return {
    ahead: aheadAt === -1 ? undefined : evenings[aheadAt],
    // Most recent first: `order` IS the chronology, so reading it backwards reads the record
    // backwards. The evening still ahead is lifted out rather than repeated here.
    record: evenings.filter((_, i) => i !== aheadAt).reverse(),
  };
};
