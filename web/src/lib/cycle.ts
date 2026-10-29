/**
 * @file cycle.ts
 * @description Which evenings are the numbered Koncerty Duchowe, what numeral each one carries,
 *  and which one is still ahead. One module, because all three questions are the same question
 *  asked at different points on the page, and every surface that prints a numeral has to answer
 *  them identically.
 *
 *  THE NUMERAL IS DERIVED, NEVER STORED. It used to sit in `concerts.yaml` as `roman`, which made
 *  the sequence a hand-kept fact: inserting an evening between two others meant renumbering the
 *  rest by hand, in a file whose build cannot tell a wrong numeral from a right one. It is the
 *  same argument `/koncerty` already makes for its via-rail percentages, and the same one the
 *  landing makes for its evening count — position is the fact; the glyph is a rendering of it.
 *
 *  NOT EVERY EVENING IS A STATION. The ensemble also sings liturgies and weddings, and those are
 *  not stations of the cycle: they carry no numeral, stand outside the walk, and must never be
 *  announced as "the next Spiritual Concert". `cycle: false` in the corpus is what says so, and it
 *  is a claim about the EVENING rather than about its layout — `variant: liturgy` is the plate the
 *  page draws it on, and the two are independent (Aeternam is a memoriam plate and a station).
 * @module lib/cycle
 */
// Explicit extension: `lib/pressKit` imports this module, and the press-pack generator loads that
// under bare Node, which resolves no extensionless specifier.
import { isEveningAhead } from "./calendar.ts";
import { romanNumeral } from "./dates.ts";

/** One evening's clock — the row's own, or one of its `dates[]`. */
interface EveningSlice {
  readonly date: string;
  readonly time?: string | undefined;
  readonly endTime?: string | undefined;
}

/** The slice of a `concerts` entry this module reads — structural, like lib/registrum's. */
export interface CycleStation {
  readonly id: string;
  readonly data: {
    readonly order: number;
    readonly cycle: boolean;
    readonly date?: string | undefined;
    readonly time?: string | undefined;
    readonly endTime?: string | undefined;
    readonly venue?: string | undefined;
    readonly dates?: readonly EveningSlice[] | undefined;
  };
}

/**
 * The fields that belong to ONE EVENING rather than to the programme — everything a `dates[]` item
 * may state (content.config). The programme, its notes, its record and its photographs are the
 * row's whichever night is announced.
 */
const EVENING_FIELDS = [
  "date",
  "time",
  "endTime",
  "venue",
  "venueNote",
  "address",
  "mapUrl",
  "facebookEvent",
  "admission",
  "festival",
  "festivalNote",
  "organizer",
  "funding",
  "metaPlace",
  "invitation",
  "poster",
  "posterAlt",
  "posterCredit",
  "share",
] as const;

/** Of those, the copy — translated on the desk under `dates.<date>.<field>` for a performance. */
const EVENING_COPY: ReadonlySet<string> = new Set([
  "metaPlace",
  "venueNote",
  "festivalNote",
  "funding",
  "invitation",
  "posterAlt",
]);

/**
 * A station as the announcing surfaces receive it. `performance` is the date of the `dates[]` item
 * laid over the row, and is absent where the evening ahead is the row's own.
 */
export type Upcoming<T extends CycleStation> = T & { readonly performance?: string };

/** Every evening a row states: its `dates[]`, or its own where it has none. */
const eveningsOf = (data: CycleStation["data"]): readonly EveningSlice[] =>
  data.dates && data.dates.length > 0
    ? data.dates
    : data.date !== undefined
      ? [{ date: data.date, time: data.time, endTime: data.endTime }]
      : [];

const eveningStart = (evening: EveningSlice): string => `${evening.date}T${evening.time ?? "00:00"}`;

/**
 * The first evening of a row still ahead (`lib/calendar`'s `isEveningAhead`), or `undefined` when
 * every one of them has been sung.
 */
export const nextEvening = (
  data: CycleStation["data"],
  now: Date = new Date(),
): EveningSlice | undefined =>
  eveningsOf(data)
    .filter((evening) => isEveningAhead(evening, now))
    .sort((a, b) => eveningStart(a).localeCompare(eveningStart(b)))[0];

/**
 * No evening of this row has been sung yet. Not the same as "an evening is ahead": a programme
 * booked again has a record AND an announcement, and the record's surprises — the encore above all
 * — are no longer the ensemble's to keep.
 */
export const isUnsung = (data: CycleStation["data"], now: Date = new Date()): boolean => {
  const evenings = eveningsOf(data);
  return evenings.length > 0 && evenings.every((evening) => isEveningAhead(evening, now));
};

/**
 * The desk key a copy field of a station is translated under: the performance's own
 * (`dates.<date>.<field>`) for an evening field of a projected repeat, the row's otherwise.
 */
export const eveningKey = (station: { readonly performance?: string }, field: string): string =>
  station.performance !== undefined && EVENING_COPY.has(field)
    ? `dates.${station.performance}.${field}`
    : field;

/**
 * The row with one of its `dates[]` laid over it. Every evening field comes from the item, unset
 * ones included: a repeat that states no Facebook event has none, rather than the first night's.
 * The place line falls back to the venue, since a dateline cannot be left without one.
 */
const project = <T extends CycleStation>(entry: T, evening: EveningSlice): Upcoming<T> => {
  if (evening.date === entry.data.date) return entry;
  const item = evening as EveningSlice & Readonly<Record<string, unknown>>;
  const laid: Record<string, unknown> = {};
  for (const field of EVENING_FIELDS) laid[field] = item[field];
  laid.metaPlace = item.metaPlace ?? { pl: item.venue };
  laid.dateLabel = undefined;
  return { ...entry, data: { ...entry.data, ...laid }, performance: evening.date };
};

const byOrder = <T extends CycleStation>(entries: readonly T[]): T[] =>
  [...entries].sort((a, b) => a.data.order - b.data.order);

/** The cycle's own stations, in Via order. */
export const cycleStations = <T extends CycleStation>(entries: readonly T[]): T[] =>
  byOrder(entries).filter((entry) => entry.data.cycle);

/** Everything the ensemble sang that the cycle does not number, in the same chronology. */
export const otherOffices = <T extends CycleStation>(entries: readonly T[]): T[] =>
  byOrder(entries).filter((entry) => !entry.data.cycle);

/**
 * Concert id → its roman numeral, for stations only. A surface holding an evening that is not in
 * the cycle gets `undefined` from this map and must print no numeral at all — an office with a
 * numeral is the error this replaced.
 */
export const cycleNumerals = (entries: readonly CycleStation[]): ReadonlyMap<string, string> =>
  new Map(cycleStations(entries).map((entry, i) => [entry.id, romanNumeral(i + 1)]));

/**
 * The evening that has not happened yet — the soonest station still ahead (`lib/calendar`'s
 * `isEveningAhead`), or `undefined`, which is the resting state this site was in for its whole
 * life until 2026.
 *
 * THE NEXT CONCERT IS THE ROW'S NEXT EVENING, not the row's first date. A programme sung again
 * keeps one row (its record, its photographs, its recording) and gains a `dates[]` item; the
 * station comes back with that item's facts laid over it (`project`), so the hero's pill, the
 * landing's band, the door band and the press card announce the repeat without one of them knowing
 * it is a repeat. A surface that prints copy from the result asks `eveningKey` for the desk key.
 *
 * Read at BUILD time, so the announcement it drives (the hero's pill, the landing's Proximum band,
 * the station's own marker) survives its own concert until the next deploy. That is the direction
 * that costs least — the same trade `lib/eventSchema` documents for `eventStatus` — but it IS a
 * standing obligation: a deploy after the evening's slot closes is what takes the announcement
 * down.
 *
 * Stations only. A wedding or a liturgy in the corpus is not what "the next concert" means, and
 * the pill that names it would be inviting strangers to somebody's wedding.
 */
export const upcomingStation = <T extends CycleStation>(
  entries: readonly T[],
  now: Date = new Date(),
): Upcoming<T> | undefined => {
  const soonest = cycleStations(entries)
    .flatMap((entry) => {
      const evening = nextEvening(entry.data, now);
      return evening ? [{ entry, evening }] : [];
    })
    .sort((a, b) => eveningStart(a.evening).localeCompare(eveningStart(b.evening)))[0];
  return soonest && project(soonest.entry, soonest.evening);
};

/**
 * One programme as a page devoted to its evening reads it: the next performance laid over the row
 * while one is ahead, and the last one sung once none is, so a page that outlives its night still
 * builds and still names that night. It asks about this row alone, whether or not another station
 * is sooner, and holds weddings and stations alike.
 */
export const currentPerformance = <T extends CycleStation>(
  entry: T,
  now: Date = new Date(),
): Upcoming<T> => {
  const evening =
    nextEvening(entry.data, now) ??
    [...eveningsOf(entry.data)].sort((a, b) => eveningStart(a).localeCompare(eveningStart(b))).at(-1);
  return evening ? project(entry, evening) : entry;
};
