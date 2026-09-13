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
 * @architecture Astro islands 2026
 * @module lib/cycle
 */
import { romanNumeral } from "./dates";

/** The slice of a `concerts` entry this module reads — structural, like lib/registrum's. */
export interface CycleStation {
  readonly id: string;
  readonly data: {
    readonly order: number;
    readonly cycle: boolean;
    readonly date?: string | undefined;
  };
}

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
 * The evening that has not happened yet — the soonest station dated today or later, or
 * `undefined`, which is the resting state this site was in for its whole life until 2026.
 *
 * Read at BUILD time, so the announcement it drives (the hero's pill, the landing's Proximum band,
 * the station's own marker) survives its own concert until the next deploy. That is the direction
 * that costs least — the same trade `lib/eventSchema` documents for `eventStatus` — but it IS a
 * standing obligation: a deploy after the date is what takes the announcement down.
 *
 * Stations only. A wedding or a liturgy in the corpus is not what "the next concert" means, and
 * the pill that names it would be inviting strangers to somebody's wedding.
 */
export const upcomingStation = <T extends CycleStation>(
  entries: readonly T[],
  now: Date = new Date(),
): T | undefined =>
  cycleStations(entries)
    .filter((entry) => {
      if (!entry.data.date) return false;
      // End of the concert's own day, so an evening happening tonight is still ahead all day.
      const closes = new Date(`${entry.data.date}T23:59:59`);
      return !Number.isNaN(closes.getTime()) && closes.getTime() >= now.getTime();
    })
    .sort(
      (a, b) => new Date(`${a.data.date}`).getTime() - new Date(`${b.data.date}`).getTime(),
    )[0];
