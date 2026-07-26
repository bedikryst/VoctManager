/**
 * @file wallClock.ts
 * @description Calendar arithmetic for the date field, on wall-clock fields
 * rather than instants. The values this control edits (`yyyy-MM-ddTHH:mm`) are
 * already stated in the venue's timezone, so parsing one into a `Date` would
 * re-apply the browser's offset and move the concert by an hour twice a year.
 * Every `Date` built here is therefore a FLOATING date — noon local, used only
 * to lay out a month and to ask date-fns for a localised label — and never
 * travels back into a value.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DateTimeField
 */

import { addMonths, format, startOfMonth, startOfWeek, type Locale } from "date-fns";

/** Length of the `yyyy-MM-ddTHH:mm` value a date-and-time field holds. */
const LOCAL_INPUT_LENGTH = 16;
const DAYS_IN_GRID = 42;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export interface CalendarDate {
  readonly year: number;
  /** 1–12. Calendar months, not the zero-based ones `Date` speaks. */
  readonly month: number;
  readonly day: number;
}

export interface Clock {
  readonly hours: number;
  readonly minutes: number;
}

export type WallClock = CalendarDate & Clock;

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Noon, so that a floating date survives every timezone shift a browser might
 * apply while formatting it — a midnight date in a negative-offset zone renders
 * as the previous day.
 */
export const toFloatingDate = (date: CalendarDate): Date =>
  new Date(date.year, date.month - 1, date.day, 12, 0, 0, 0);

export const fromFloatingDate = (date: Date): CalendarDate => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
});

/** The `yyyy-MM-dd` key a marker is matched on. */
export const toDateKey = (date: CalendarDate): string =>
  `${date.year}-${pad(date.month)}-${pad(date.day)}`;

export const todayCalendarDate = (): CalendarDate => fromFloatingDate(new Date());

export const isSameCalendarDate = (
  left: CalendarDate | null,
  right: CalendarDate | null,
): boolean =>
  left !== null &&
  right !== null &&
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day;

export const parseWallClock = (value?: string | null): WallClock | null => {
  if (!value || value.length < LOCAL_INPUT_LENGTH) {
    return null;
  }

  const parts = [
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)),
    Number(value.slice(8, 10)),
    Number(value.slice(11, 13)),
    Number(value.slice(14, 16)),
  ];

  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [year, month, day, hours, minutes] = parts;

  return { year, month, day, hours, minutes };
};

export const formatWallClock = (value: WallClock): string =>
  `${toDateKey(value)}T${pad(value.hours)}:${pad(value.minutes)}`;

export const parseClock = (value?: string | null): Clock | null => {
  if (!value || value.length < 5) {
    return null;
  }

  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return { hours, minutes };
};

export const formatClock = (clock: Clock): string =>
  `${pad(clock.hours)}:${pad(clock.minutes)}`;

/** Wraps rather than clamps: stepping past 23:00 lands on 00:00, as a clock does. */
export const wrapValue = (value: number, limit: number): number =>
  ((value % limit) + limit) % limit;

export const wrapHours = (hours: number): number =>
  wrapValue(hours, HOURS_PER_DAY);

export const wrapMinutes = (minutes: number): number =>
  wrapValue(minutes, MINUTES_PER_HOUR);

/**
 * The six weeks a month view draws. Always six, so navigating from a 4-row
 * February to a 6-row March does not resize the popover under the pointer.
 */
export const buildMonthGrid = (
  visibleMonth: Date,
  locale: Locale,
): CalendarDate[] => {
  const firstCell = startOfWeek(startOfMonth(visibleMonth), { locale });

  return Array.from({ length: DAYS_IN_GRID }, (_, index) => {
    const cell = new Date(firstCell);
    cell.setDate(firstCell.getDate() + index);
    return fromFloatingDate(cell);
  });
};

/** The localised two-or-three letter column heads, in the locale's week order. */
export const buildWeekdayLabels = (locale: Locale): string[] => {
  const firstDay = startOfWeek(new Date(), { locale });

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    return format(day, "EEEEEE", { locale });
  });
};

/**
 * Polish (like Czech and Russian) inflects the month after a day number:
 * "26 lipca" but "lipiec 2026". `MMMM` is the genitive form used with a day,
 * `LLLL` the standalone one a header needs — swapping them is the single most
 * visible way a calendar can read as machine-translated.
 */
export const formatMonthHeading = (month: Date, locale: Locale): string =>
  format(month, "LLLL yyyy", { locale });

export const formatMonthName = (month: Date, locale: Locale): string =>
  format(month, "LLLL", { locale });

export const formatDayLabel = (date: CalendarDate, locale: Locale): string =>
  format(toFloatingDate(date), "EEEE, d MMMM yyyy", { locale });

/**
 * The trigger's date half: "sob. 26 lipca 2026". No comma after the weekday —
 * the Polish and French abbreviations already end in a period.
 */
export const formatTriggerDate = (
  date: CalendarDate,
  locale: Locale,
): string => format(toFloatingDate(date), "EEE d MMMM yyyy", { locale });

export const shiftMonth = (month: Date, delta: number): Date =>
  addMonths(month, delta);
