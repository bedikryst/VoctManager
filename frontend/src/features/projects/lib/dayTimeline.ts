/**
 * @file dayTimeline.ts
 * @description Concert-day arithmetic for the run sheet: it merges the two
 * anchors a producer plans around — the call time and the downbeat — with the
 * editable points between them into one chronological list.
 * The run sheet stores bare `HH:mm`, so the concert day is its implicit frame;
 * an anchor that falls on another day therefore carries a day offset and is
 * placed by it. Ordering is the only warning this needs: a point that lands
 * before the call or after the downbeat simply renders outside the anchors.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/dayTimeline
 */

import type { RunSheetItem } from "@/shared/types";

/** Length of the `yyyy-MM-ddTHH:mm` wall-clock value a date field holds. */
const LOCAL_INPUT_LENGTH = 16;
const MINUTES_PER_DAY = 24 * 60;
const LAST_MINUTE_OF_DAY = MINUTES_PER_DAY - 1;
const MS_PER_DAY = 86_400_000;

export type DayAnchorKind = "call" | "concert";

export interface DayTimelineAnchor {
  readonly kind: DayAnchorKind;
  /** Wall-clock time in the project's timezone. */
  readonly time: string;
  /** Days from the concert day: 0 same day, -1 the evening before, +1 after. */
  readonly dayOffset: number;
}

export interface DayTimelinePoint {
  readonly kind: "point";
  readonly item: RunSheetItem;
}

export type DayTimelineEntry = DayTimelineAnchor | DayTimelinePoint;

interface WallClock {
  /** Whole days since the epoch — a calendar index, never an instant. */
  readonly dayIndex: number;
  readonly minutes: number;
}

/**
 * Reads the calendar fields, not an instant. The value is already wall-clock in
 * the project's timezone, so parsing it into a `Date` would re-apply the
 * browser's own offset and let a DST boundary distort every difference taken
 * from it.
 */
const parseLocalInput = (value?: string | null): WallClock | null => {
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

  return {
    dayIndex: Date.UTC(year, month - 1, day) / MS_PER_DAY,
    minutes: hours * 60 + minutes,
  };
};

const toClockTime = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(minutes, LAST_MINUTE_OF_DAY));
  const hours = Math.floor(clamped / 60);

  return `${String(hours).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

const parseClockTime = (time: string): number | null => {
  if (!time || time.length < 5) {
    return null;
  }

  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(3, 5));

  return Number.isNaN(hours) || Number.isNaN(minutes) ? null : hours * 60 + minutes;
};

/** The `HH:mm` half of a `datetime-local` value, or null when it is incomplete. */
export const readInputTime = (value?: string | null): string | null =>
  value && value.length >= LOCAL_INPUT_LENGTH ? value.slice(11, 16) : null;

/** The `yyyy-MM-dd` half, for deciding whether an anchor needs its date shown. */
export const readInputDate = (value?: string | null): string | null =>
  value && value.length >= LOCAL_INPUT_LENGTH ? value.slice(0, 10) : null;

export const shiftClockTime = (time: string, deltaMinutes: number): string => {
  const minutes = parseClockTime(time);

  return minutes === null ? time : toClockTime(minutes + deltaMinutes);
};

/**
 * Minutes the call time sits before the downbeat. Negative or zero means the
 * producer has them the wrong way round — the caller states that instead of the
 * offset. Null when either end is not set yet.
 */
export const getCallOffsetMinutes = (
  callTime?: string | null,
  concertTime?: string | null,
): number | null => {
  const call = parseLocalInput(callTime);
  const concert = parseLocalInput(concertTime);

  if (!call || !concert) {
    return null;
  }

  return (
    (concert.dayIndex - call.dayIndex) * MINUTES_PER_DAY +
    (concert.minutes - call.minutes)
  );
};

/**
 * A fresh point lands after the day as planned so far, so adding several in a
 * row builds a sequence instead of a stack of identical times. With nothing
 * planned yet the two anchors seed it, in the order a day is actually built.
 */
export const suggestRunSheetTime = ({
  runSheet,
  callTime,
  concertTime,
}: {
  readonly runSheet: readonly RunSheetItem[];
  readonly callTime?: string | null;
  readonly concertTime?: string | null;
}): string => {
  const latest = runSheet.reduce<string>(
    (accumulator, item) =>
      item.time && item.time > accumulator ? item.time : accumulator,
    "",
  );

  if (latest) {
    return shiftClockTime(latest, 30);
  }

  const call = readInputTime(callTime);
  if (call) {
    return shiftClockTime(call, 15);
  }

  const concert = readInputTime(concertTime);
  if (concert) {
    return shiftClockTime(concert, -60);
  }

  return "12:00";
};

const anchorSortKey = (anchor: DayTimelineAnchor): number =>
  anchor.dayOffset * MINUTES_PER_DAY +
  (parseClockTime(anchor.time) ?? 0) +
  // Tie-break, so a point sharing an anchor's minute reads as happening inside
  // the day the anchors bracket rather than before it opens or after it ends.
  (anchor.kind === "call" ? -0.5 : 0.5);

const buildAnchor = (
  kind: DayAnchorKind,
  value: string | null | undefined,
  concertDayIndex: number | null,
): DayTimelineAnchor | null => {
  const parsed = parseLocalInput(value);

  if (!parsed) {
    return null;
  }

  return {
    kind,
    time: toClockTime(parsed.minutes),
    dayOffset:
      concertDayIndex === null ? 0 : parsed.dayIndex - concertDayIndex,
  };
};

/**
 * Merges the anchors INTO the run sheet without reordering it. The points
 * arrive in the order the form committed (see `useDetailsForm`, which sorts on
 * commit rather than on keystroke, so a half-typed time cannot yank the row
 * being edited to the top of the day).
 */
export const buildDayTimeline = ({
  runSheet,
  callTime,
  concertTime,
}: {
  readonly runSheet: readonly RunSheetItem[];
  readonly callTime?: string | null;
  readonly concertTime?: string | null;
}): DayTimelineEntry[] => {
  const concertDayIndex = parseLocalInput(concertTime)?.dayIndex ?? null;

  const anchors = [
    buildAnchor("call", callTime, concertDayIndex),
    buildAnchor("concert", concertTime, concertDayIndex),
  ]
    .filter((anchor): anchor is DayTimelineAnchor => anchor !== null)
    .sort((left, right) => anchorSortKey(left) - anchorSortKey(right));

  // An unset time inherits its predecessor's position, so a row mid-edit stays
  // between the same neighbours instead of collapsing to the start of the day.
  let carried = 0;
  const pointKeys = runSheet.map((item) => {
    carried = parseClockTime(item.time) ?? carried;
    return carried;
  });

  const entries: DayTimelineEntry[] = [];
  let nextAnchor = 0;

  runSheet.forEach((item, index) => {
    while (
      nextAnchor < anchors.length &&
      anchorSortKey(anchors[nextAnchor]) < pointKeys[index]
    ) {
      entries.push(anchors[nextAnchor]);
      nextAnchor += 1;
    }

    entries.push({ kind: "point", item });
  });

  return [...entries, ...anchors.slice(nextAnchor)];
};
