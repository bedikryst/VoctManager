/**
 * @file seasonPulse.ts
 * @description Condenses the upcoming feed into a per-day "pulse" model for the
 * SeasonRibbon — one cell per day that actually has something on it, carrying a
 * dominant tone so a chorister can feel the whole season at a glance and jump
 * straight to a date. Keys match groupByDay so the ribbon can scroll the feed.
 */

import { dayKey } from "./groupByDay";
import type { TimelineEvent } from "../types/schedule.dto";

/** Visual semantics, in descending priority when a day holds several events. */
export type PulseTone = "concert" | "absent" | "late" | "present" | "open";

export interface SeasonDay {
  key: string;
  date: Date;
  tone: PulseTone;
  eventCount: number;
  hasConcert: boolean;
}

const tonePriority: Record<PulseTone, number> = {
  concert: 5,
  absent: 4,
  late: 3,
  present: 2,
  open: 1,
};

const eventTone = (event: TimelineEvent): PulseTone => {
  if (event.type === "PROJECT") return "concert";
  const status = event.status === "EXCUSED" ? "ABSENT" : event.status;
  if (status === "ABSENT") return "absent";
  if (status === "LATE") return "late";
  if (status === "PRESENT") return "present";
  return "open";
};

export const buildSeasonPulse = (events: TimelineEvent[]): SeasonDay[] => {
  const map = new Map<string, SeasonDay>();

  for (const event of events) {
    const key = dayKey(event.date_time);
    const tone = eventTone(event);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        date: event.date_time,
        tone,
        eventCount: 1,
        hasConcert: event.type === "PROJECT",
      });
      continue;
    }

    existing.eventCount += 1;
    existing.hasConcert = existing.hasConcert || event.type === "PROJECT";
    if (tonePriority[tone] > tonePriority[existing.tone]) existing.tone = tone;
  }

  return [...map.values()];
};
