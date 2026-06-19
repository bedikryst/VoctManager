/**
 * @file groupByDay.ts
 * @description Groups timeline events into viewer-local calendar days and
 * produces human relative labels ("Dziś" / "Jutro" / "czw, 18 cze"). Grouping
 * by the *viewer's* day (not each event's own timezone) matches how a person
 * reads their own calendar — the per-event row still shows the precise local
 * time via DualTimeDisplay.
 */

import type { TFunction } from "i18next";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type { TimelineEvent } from "../types/schedule.dto";

/** Stable per-day key in the viewer's local zone (shared with the season pulse). */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export interface DayGroup {
  key: string;
  date: Date;
  events: TimelineEvent[];
}

/**
 * Buckets events by local day, preserving the incoming order (events arrive
 * already sorted asc/desc), so the resulting groups are chronological too.
 */
export const groupEventsByDay = (events: TimelineEvent[]): DayGroup[] => {
  const map = new Map<string, DayGroup>();

  for (const event of events) {
    const key = dayKey(event.date_time);
    const group = map.get(key);
    if (group) {
      group.events.push(event);
    } else {
      map.set(key, { key, date: event.date_time, events: [event] });
    }
  }

  return [...map.values()];
};

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Dziś" / "Jutro" / "Wczoraj" for the near band, otherwise a short date. */
export const relativeDayLabel = (
  date: Date,
  now: Date,
  t: TFunction,
): string => {
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);

  if (diffDays === 0) return t("schedule.day.today", "Dziś");
  if (diffDays === 1) return t("schedule.day.tomorrow", "Jutro");
  if (diffDays === -1) return t("schedule.day.yesterday", "Wczoraj");

  return formatLocalizedDate(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};
