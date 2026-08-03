/**
 * @file eventSchema.ts
 * @description Single owner of the schema.org `MusicEvent` node. Two surfaces describe the
 *  same concerts — /koncerty as an ItemList of every station, /koncerty/[id] as the concert
 *  itself (one node per date on a touring programme) — and each used to hand-write the shape.
 *  That is how `eventStatus` came to be pinned to "EventCompleted" in both places: true of
 *  every concert sung so far, and false of the first one ever announced ahead of time.
 *
 *  Everything here is derived or omitted, never asserted on a hunch: status comes from the
 *  calendar, `offers` appears only where admission is actually recorded, and a field nobody
 *  can source (a concert's `endDate` — the ensemble keeps no durations) simply stays absent.
 *  A missing recommended field costs a Search Console warning; a wrong one costs the truth.
 * @architecture Astro islands 2026
 * @module lib/eventSchema
 */

import { SITE } from "../i18n/config";

/** What the door cost, where the ensemble actually recorded it. */
export type Admission = "free" | "paid";

/** The shared ensemble node — the SAME `@id` the landing's MusicGroup graph declares, so
    every concert folds into one performer entity instead of minting a twin per page. */
const PERFORMER = {
  "@type": "MusicGroup",
  "@id": `${SITE}/#ensemble`,
  name: "VoctEnsemble",
} as const;

/** Likewise the foundation that puts the cycle on — `@id` shared with the landing's `funder`. */
const ORGANIZER = {
  "@type": "NGO",
  "@id": `${SITE}/#foundation`,
  name: "VoctFoundation",
  url: SITE,
} as const;

export interface EventSeed {
  /** Concert title as it is printed. */
  readonly name: string;
  /** One-paragraph summary — the concert's `essence`. */
  readonly description: string;
  /** Absolute https URL of the share image. */
  readonly image?: string;
  /** Absolute https URL of the concert's own page; absent for entries with no `hasPage`. */
  readonly url?: string;
  /** ISO "YYYY-MM-DD". Absent when the YAML date is vague (a season or a bare year). */
  readonly date?: string;
  /** "HH:MM" — folded into `startDate`, and only meaningful alongside a date. */
  readonly time?: string;
  /** Venue name alone (Place.name). */
  readonly venue: string;
  /** Street address of the venue as free text — schema.org accepts Text here, and a plain
      line is what the ensemble's own records hold. */
  readonly address?: string;
  readonly admission?: Admission;
}

/** The emitted node. Deliberately open-valued: this is JSON-LD on its way to `JSON.stringify`,
    and a hand-maintained mirror of schema.org's shape would rot without ever being checked. */
export type MusicEventNode = Record<string, unknown>;

/**
 * Status read off the calendar rather than set by hand. Declaring `EventCompleted` on a concert
 * that has not happened yet tells Google to drop it from event results — precisely when the
 * markup would finally be worth something. An undated entry gets no status at all: with no day
 * to compare against, either value is a guess.
 *
 * Resolved at BUILD time, so an upcoming concert keeps saying `EventScheduled` until the first
 * deploy after its date. That drift is the harmless direction (a day-stale "scheduled" costs
 * nothing), whereas the reverse would suppress the result outright.
 */
const eventStatusFor = (date: string | undefined, now: Date): string | undefined => {
  if (!date) return undefined;
  // End-of-day, so a concert happening tonight still reads as scheduled all day.
  const closes = new Date(`${date}T23:59:59`);
  if (Number.isNaN(closes.getTime())) return undefined;
  return closes.getTime() >= now.getTime()
    ? "https://schema.org/EventScheduled"
    : "https://schema.org/EventCompleted";
};

/**
 * `offers` only where admission is on record. A free concert states price 0 — true, and exactly
 * what Google asks for. A paid one whose ticket price nobody wrote down gets the honest negative
 * (`isAccessibleForFree: false`) and no Offer at all, because an invented price is worse than a
 * missing field. Unknown admission emits neither.
 *
 * `availability` is deliberately absent: these concerts are sung and over, and "InStock" on a
 * 2024 evening would be false.
 */
const offersFor = (
  admission: Admission | undefined,
  url: string | undefined,
): MusicEventNode => {
  if (admission === "free") {
    return {
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "PLN",
        ...(url ? { url } : {}),
      },
    };
  }
  if (admission === "paid") return { isAccessibleForFree: false };
  return {};
};

/** Build one `MusicEvent` node. `now` is injectable so the status rule stays testable. */
export const musicEvent = (seed: EventSeed, now: Date = new Date()): MusicEventNode => {
  const status = eventStatusFor(seed.date, now);
  return {
    "@type": "MusicEvent",
    name: seed.name,
    description: seed.description,
    ...(seed.url ? { url: seed.url } : {}),
    ...(seed.image ? { image: seed.image } : {}),
    ...(seed.date ? { startDate: seed.time ? `${seed.date}T${seed.time}:00` : seed.date } : {}),
    ...(status ? { eventStatus: status } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: seed.venue,
      ...(seed.address ? { address: seed.address } : {}),
    },
    performer: PERFORMER,
    organizer: ORGANIZER,
    ...offersFor(seed.admission, seed.url),
  };
};

/** Absolute form of a build-emitted asset path (`/_astro/…webp`) for JSON-LD, which — unlike
    the page's own markup — is read away from the document and cannot resolve a relative URL. */
export const absolute = (path: string): string => new URL(path, SITE).href;
