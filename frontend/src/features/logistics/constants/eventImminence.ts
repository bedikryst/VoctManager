/**
 * @file eventImminence.ts
 * @description Time-to-event taxonomy shared by the logistics command surfaces.
 * Buckets an event by how soon it happens and maps each bucket to an Ethereal
 * accent + atlas marker colour so the rail rows, dossier and map markers all
 * speak the same temporal dialect. Colour discipline: crimson stays an alarm,
 * so "today" reads as gold (active/now), not crimson.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/constants/eventImminence
 */

export type EventImminence = "TODAY" | "SOON" | "UPCOMING" | "PAST";

export interface ImminenceDefinition {
  value: EventImminence;
  labelKey: string;
  defaultLabel: string;
  /** Atlas marker / glow colour, token-driven via CSS variable. */
  marker: string;
  /** Whether map markers in this bucket should pulse (draws the eye to "now"). */
  pulse: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const IMMINENCE_DEFINITIONS: Record<EventImminence, ImminenceDefinition> = {
  TODAY: {
    value: "TODAY",
    labelKey: "logistics.imminence.today",
    defaultLabel: "Dziś",
    marker: "var(--color-ethereal-gold)",
    pulse: true,
  },
  SOON: {
    value: "SOON",
    labelKey: "logistics.imminence.soon",
    defaultLabel: "W tym tygodniu",
    marker: "var(--color-ethereal-amethyst)",
    pulse: false,
  },
  UPCOMING: {
    value: "UPCOMING",
    labelKey: "logistics.imminence.upcoming",
    defaultLabel: "Wkrótce",
    marker: "var(--color-ethereal-sage)",
    pulse: false,
  },
  PAST: {
    value: "PAST",
    labelKey: "logistics.imminence.past",
    defaultLabel: "Minione",
    marker: "var(--color-ethereal-incense)",
    pulse: false,
  },
};

/** Whole-day difference between two dates, ignoring clock time. */
const dayDiff = (target: Date, reference: Date): number => {
  const a = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const b = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  ).getTime();
  return Math.round((a - b) / DAY_MS);
};

export const resolveImminence = (
  date: Date,
  now: Date = new Date(),
): EventImminence => {
  const diff = dayDiff(date, now);
  if (diff < 0) return "PAST";
  if (diff === 0) return "TODAY";
  if (diff <= 7) return "SOON";
  return "UPCOMING";
};

export const getImminenceDefinition = (
  value: EventImminence,
): ImminenceDefinition => IMMINENCE_DEFINITIONS[value];

/** Days until the event (0 = today, negative = in the past). */
export const daysUntil = (date: Date, now: Date = new Date()): number =>
  dayDiff(date, now);
