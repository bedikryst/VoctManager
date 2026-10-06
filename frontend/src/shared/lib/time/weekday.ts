/**
 * @file weekday.ts
 * @description The short weekday a date stamp prints over its day number, in
 * the one form the app uses for it: the date picker's column heads (date-fns'
 * short weekday — "pon", "wto", "śro" in Polish). Read in the zone the caller
 * names, so it always agrees with the day number beside it.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/time/weekday
 */

import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { getDateFnsLocale } from "./dateFnsLocale";

/** date-fns' short weekday — the calendar's column heads are written with it too. */
export const SHORT_WEEKDAY_PATTERN = "EEEEEE";

/** The short weekday of `value` in `timeZone` (the reader's own when omitted). */
export const formatShortWeekday = (
  value: Date | string | number,
  timeZone?: string,
  language?: string,
): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const locale = getDateFnsLocale(language);
  return timeZone
    ? formatInTimeZone(date, timeZone, SHORT_WEEKDAY_PATTERN, { locale })
    : format(date, SHORT_WEEKDAY_PATTERN, { locale });
};
