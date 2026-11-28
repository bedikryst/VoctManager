/**
 * @file relativeDay.ts
 * @description How the locations list names an event's day: within a week by
 * its distance ("Dziś", "Jutro", "za 3 dni"), further out by its date
 * ("31 sty"). Whole calendar days, the clock time ignored (`daysUntil`).
 * @module features/logistics/lib/relativeDay
 */

import type { TFunction } from "i18next";

import { daysUntil } from "../constants/eventImminence";

/** The day's distance within a week, or null past it. */
export const formatRelativeDay = (date: Date, t: TFunction): string | null => {
  const diff = daysUntil(date);
  if (diff <= 0) return t("logistics.imminence.today", "Dziś");
  if (diff === 1) return t("logistics.timezone.tomorrow", "Jutro");
  if (diff <= 7) return t("logistics.timezone.in_days", "za {{count}} dni", { count: diff });
  return null;
};

/** "31 sty": the day and the short month, in the reader's language. */
export const formatShortDate = (date: Date, language: string): string =>
  new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(date);
