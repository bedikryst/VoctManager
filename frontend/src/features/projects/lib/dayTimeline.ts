/**
 * @file dayTimeline.ts
 * @description Plan arithmetic for the run sheet: it merges the fixed moments a
 * producer plans around — the call time, the downbeat, and the two typed
 * windows (warm-up, sound check) — with the editable points between them into
 * one chronological list.
 * Concert day is the frame. A point stores a bare `HH:mm` on the day its `day`
 * offset names, a window on the day its `*_day` column names, and an anchor
 * carries a real date and is placed by its distance from the concert's — so a
 * trip's departure the day before opens the list. Ordering is the only warning
 * this needs: a point that lands before the call or after the downbeat simply
 * renders outside the anchors.
 * The order is `point_sort_key` and the merge is `build_day_timeline`, both in
 * `roster/domain/day_timeline.py`; `day_timeline_cases.json` is replayed by
 * both suites, so the panel and the printed sheet cannot order a plan
 * differently without a red test.
 * The windows join this axis rather than opening a second list of hours,
 * because a producer who moves the sound check on top of a run-sheet point can
 * only see the collision on one axis — and the printed sheet already merges
 * them (`roster/infrastructure/document_generator._structured_day_points`).
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/dayTimeline
 */

import { toZonedWallClock } from "@/shared/lib/time/timezone";
import type { Project, RunSheetItem } from "@/shared/types";

/** Length of the `yyyy-MM-ddTHH:mm` wall-clock value a date field holds. */
const LOCAL_INPUT_LENGTH = 16;
const MINUTES_PER_DAY = 24 * 60;
const LAST_MINUTE_OF_DAY = MINUTES_PER_DAY - 1;
const MS_PER_DAY = 86_400_000;
/** The choir's own zone, for a project stored before the field was required. */
const DEFAULT_TIMEZONE = "Europe/Warsaw";

export type DayAnchorKind = "call" | "concert";
export type DayWindowKind = "warmup" | "soundcheck";
export type DayFixtureKind = DayAnchorKind | DayWindowKind;

export interface DayTimelineAnchor {
  readonly kind: DayAnchorKind;
  /** Wall-clock time in the project's timezone. */
  readonly time: string;
  /** Days from the concert day: 0 same day, -1 the evening before, +1 after. */
  readonly dayOffset: number;
}

/**
 * A moment of the day that carries no wording of its own — which is exactly why
 * it is a typed column and not a run-sheet row: the surface names it in the
 * reader's language, where a hand-typed title stays in the writer's.
 */
export interface DayTimelineWindow {
  readonly kind: DayWindowKind;
  /** Wall-clock time on the window's day. */
  readonly time: string;
  /** Closing hour where one is set; an open window is the normal case. */
  readonly endTime: string | null;
  /** Days from the concert day — the acoustic rehearsal of a trip is often
   *  the evening before. */
  readonly dayOffset: number;
}

export interface DayTimelinePoint {
  readonly kind: "point";
  readonly item: RunSheetItem;
  /** The row's `day`, read the way the backend reads it: concert day for
   *  anything that is not a whole offset in range. */
  readonly dayOffset: number;
}

/** Anything placed on the day by a field rather than typed into the list. */
export type DayTimelineFixture = DayTimelineAnchor | DayTimelineWindow;

export type DayTimelineEntry = DayTimelineFixture | DayTimelinePoint;

export const isDayWindow = (
  entry: DayTimelineEntry,
): entry is DayTimelineWindow =>
  entry.kind === "warmup" || entry.kind === "soundcheck";

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

/**
 * Minutes since midnight for `H:mm` / `HH:mm`. Deliberately tolerant of the
 * unpadded hour: `run_sheet` is an unvalidated JSON field with rows older than
 * the current time control, and the backend reader parses them the same way
 * (`roster/domain/day_timeline.py`). Anything else is null — the caller decides
 * what an unreadable time means, because the editor and the printed sheet
 * answer that differently.
 */
const parseClockTime = (time: string): number | null => {
  const [rawHours, rawMinutes, ...rest] = (time ?? "").trim().split(":");

  if (rest.length > 0 || rawMinutes === undefined) {
    return null;
  }

  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    rawHours === "" ||
    rawMinutes === ""
  ) {
    return null;
  }

  const total = hours * 60 + minutes;

  return total < 0 || total >= MINUTES_PER_DAY ? null : total;
};

/** The days a plan may reach, counted from concert day. Mirrors
 *  `MIN_DAY_OFFSET` / `MAX_DAY_OFFSET` in `roster/domain/day_timeline.py`. */
export const MIN_DAY_OFFSET = -3;
export const MAX_DAY_OFFSET = 3;

/** Every day a plan may reach, in order — the day select's options. */
export const PLAN_DAY_OFFSETS: readonly number[] = Array.from(
  { length: MAX_DAY_OFFSET - MIN_DAY_OFFSET + 1 },
  (_, index) => MIN_DAY_OFFSET + index,
);

/**
 * A row's day of the plan when it is off concert day, `undefined` otherwise.
 * The backend refuses a `day` that is not a whole number in range, so a value
 * read out of stored JSON is kept only when it would pass that check; a
 * missing key already means concert day, and writing `0` adds nothing.
 */
export const readRunSheetDay = (value: unknown): number | undefined =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value !== 0 &&
  value >= MIN_DAY_OFFSET &&
  value <= MAX_DAY_OFFSET
    ? value
    : undefined;

/**
 * A stored day of the plan — a row's `day` or a window's `*_day` — or concert
 * day for anything that is not one. The same reading as `_read_day_offset`
 * on the backend: a reader never errors on old JSON, it degrades.
 */
export const readDayOffset = (value: unknown): number =>
  readRunSheetDay(value) ?? 0;

/**
 * Chronological order for run-sheet rows, for the two places that settle the
 * plan rather than display it (load and commit): the day first, then the
 * parsed minute — never the string, since lexically `"9:00"` follows
 * `"12:00"`. An unreadable time sorts last within its own day, not after the
 * whole trip, and keeps its input order behind a stable sort. This is
 * `point_sort_key` on the backend; the edited plan and the printed one agree
 * only while the two rules do.
 */
export const compareRunSheetItems = (
  left: Pick<RunSheetItem, "day" | "time">,
  right: Pick<RunSheetItem, "day" | "time">,
): number => {
  const dayDelta = readDayOffset(left.day) - readDayOffset(right.day);

  if (dayDelta !== 0) {
    return dayDelta;
  }

  const leftMinutes = parseClockTime(left.time || "");
  const rightMinutes = parseClockTime(right.time || "");

  if (leftMinutes === null || rightMinutes === null) {
    return Number(leftMinutes === null) - Number(rightMinutes === null);
  }

  return leftMinutes - rightMinutes;
};

export const sortRunSheet = <T extends Pick<RunSheetItem, "day" | "time">>(
  items: readonly T[],
): T[] => [...items].sort(compareRunSheetItems);

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
 * Where a fixture goes when it shares a minute with a typed point. The call
 * opens the day, so it precedes one; the downbeat closes it. A window sits
 * between the two, which is what the printed sheet does — there the windows are
 * appended to the point list and a stable sort leaves a point of the same
 * minute ahead of them.
 */
const FIXTURE_NUDGE: Record<DayFixtureKind, number> = {
  call: -0.5,
  warmup: 0.25,
  soundcheck: 0.25,
  concert: 0.5,
};

/** Minutes from the start of concert day, so every day of a plan shares one
 *  axis: the evening before is negative, the morning after past 1440. */
const fixtureSortKey = (fixture: DayTimelineFixture): number =>
  fixture.dayOffset * MINUTES_PER_DAY +
  (parseClockTime(fixture.time) ?? 0) +
  FIXTURE_NUDGE[fixture.kind];

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
 * The API answers `HH:MM:SS` and the editor holds `HH:MM`; both read here, and
 * an unparsable value is dropped rather than placed at midnight.
 */
const readWallClock = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [rawHours, rawMinutes] = value.trim().split(":");

  if (rawMinutes === undefined) {
    return null;
  }

  const minutes = parseClockTime(`${rawHours}:${rawMinutes}`);

  return minutes === null ? null : toClockTime(minutes);
};

/**
 * An end without a start is not a window but half of one, and it is dropped —
 * the same answer the printed sheet gives, and the reason the editor clears the
 * closing hour when the opening one goes.
 */
const buildWindow = (
  kind: DayWindowKind,
  start: string | null | undefined,
  end: string | null | undefined,
  day: unknown,
): DayTimelineWindow | null => {
  const time = readWallClock(start);

  return time === null
    ? null
    : { kind, time, endTime: readWallClock(end), dayOffset: readDayOffset(day) };
};

/** Where a new run-sheet point starts: a day of the plan and a clock on it. */
export interface RunSheetMoment {
  readonly day: number;
  readonly time: string;
}

const clampDayOffset = (dayOffset: number): number =>
  Math.min(Math.max(dayOffset, MIN_DAY_OFFSET), MAX_DAY_OFFSET);

/**
 * A fresh point lands after the plan as it stands, on the day of its latest
 * point, so adding several in a row builds a sequence instead of a stack of
 * identical times — and a trip's evening is filled in without re-picking the
 * day on every row. With nothing planned yet the two anchors seed it, in the
 * order a day is actually built.
 */
export const suggestRunSheetMoment = ({
  runSheet,
  callTime,
  concertTime,
}: {
  readonly runSheet: readonly RunSheetItem[];
  readonly callTime?: string | null;
  readonly concertTime?: string | null;
}): RunSheetMoment => {
  const latest = runSheet.reduce<RunSheetItem | null>(
    (accumulator, item) =>
      parseClockTime(item.time || "") !== null &&
      (accumulator === null || compareRunSheetItems(item, accumulator) > 0)
        ? item
        : accumulator,
    null,
  );

  if (latest) {
    return {
      day: readDayOffset(latest.day),
      time: shiftClockTime(latest.time, 30),
    };
  }

  const concertDayIndex = parseLocalInput(concertTime)?.dayIndex ?? null;
  const call = buildAnchor("call", callTime, concertDayIndex);
  if (call) {
    return {
      day: clampDayOffset(call.dayOffset),
      time: shiftClockTime(call.time, 15),
    };
  }

  const concert = readInputTime(concertTime);
  if (concert) {
    return { day: 0, time: shiftClockTime(concert, -60) };
  }

  return { day: 0, time: "12:00" };
};

export interface DayTimelineInput {
  readonly runSheet: readonly RunSheetItem[];
  readonly callTime?: string | null;
  readonly concertTime?: string | null;
  readonly warmupStart?: string | null;
  readonly warmupEnd?: string | null;
  /** The warm-up's day counted from concert day; absent is concert day. */
  readonly warmupDay?: number | null;
  readonly soundcheckStart?: string | null;
  readonly soundcheckEnd?: string | null;
  readonly soundcheckDay?: number | null;
}

/**
 * Merges the fixtures INTO the run sheet without reordering it. The points
 * arrive in the order the caller settled on (see `useDetailsForm`, which sorts
 * on commit rather than on keystroke, so a half-typed time cannot yank the row
 * being edited to the top of the day; stored plans are sorted by
 * `buildProjectDayTimeline`).
 */
export const buildDayTimeline = ({
  runSheet,
  callTime,
  concertTime,
  warmupStart,
  warmupEnd,
  warmupDay,
  soundcheckStart,
  soundcheckEnd,
  soundcheckDay,
}: DayTimelineInput): DayTimelineEntry[] => {
  const concertDayIndex = parseLocalInput(concertTime)?.dayIndex ?? null;

  // Listed in the order two fixtures of the same minute should read; a stable
  // sort is what makes that order the tie-break.
  const fixtures = [
    buildAnchor("call", callTime, concertDayIndex),
    buildWindow("warmup", warmupStart, warmupEnd, warmupDay),
    buildWindow("soundcheck", soundcheckStart, soundcheckEnd, soundcheckDay),
    buildAnchor("concert", concertTime, concertDayIndex),
  ]
    .filter((fixture): fixture is DayTimelineFixture => fixture !== null)
    .sort((left, right) => fixtureSortKey(left) - fixtureSortKey(right));

  // An unset or unreadable time inherits its predecessor's position, so a row
  // mid-edit stays between the same neighbours instead of collapsing to the
  // start of the day. The position is clamped to the point's own day: every
  // surface groups the plan under a heading per day, and an entry placed on a
  // neighbouring day would split its day's group in two. The seed is the start
  // of the earliest day, so a first point without a time opens its own day.
  let carried = MIN_DAY_OFFSET * MINUTES_PER_DAY;
  const points = runSheet.map((item) => {
    const dayOffset = readDayOffset(item.day);
    const dayStart = dayOffset * MINUTES_PER_DAY;
    const minutes = parseClockTime(item.time || "");

    carried =
      minutes === null
        ? Math.min(Math.max(carried, dayStart), dayStart + LAST_MINUTE_OF_DAY)
        : dayStart + minutes;

    return { item, dayOffset, key: carried };
  });

  const entries: DayTimelineEntry[] = [];
  let nextFixture = 0;

  points.forEach(({ item, dayOffset, key }) => {
    while (
      nextFixture < fixtures.length &&
      fixtureSortKey(fixtures[nextFixture]) < key
    ) {
      entries.push(fixtures[nextFixture]);
      nextFixture += 1;
    }

    entries.push({ kind: "point", item, dayOffset });
  });

  return [...entries, ...fixtures.slice(nextFixture)];
};

/** One day of a plan, in order, under the heading a multi-day plan gives it. */
export interface DayTimelineGroup {
  readonly dayOffset: number;
  readonly entries: readonly DayTimelineEntry[];
}

/**
 * The merged plan cut at every change of day, for the surfaces that head each
 * day of a trip with its date. Consecutive runs, not a bucket per offset: the
 * merge clamps every entry to its own day, so a day's run is never split, and
 * cutting by run keeps the list's own order as the only order.
 */
export const groupDayTimeline = (
  entries: readonly DayTimelineEntry[],
): DayTimelineGroup[] => {
  const groups: { dayOffset: number; entries: DayTimelineEntry[] }[] = [];

  entries.forEach((entry) => {
    const current = groups[groups.length - 1];

    if (current && current.dayOffset === entry.dayOffset) {
      current.entries.push(entry);
    } else {
      groups.push({ dayOffset: entry.dayOffset, entries: [entry] });
    }
  });

  return groups;
};

/**
 * Whether the plan reaches past concert day — any entry, the call included.
 * There is no switch for a trip: a plan with a point the evening before is
 * one, and every surface then titles it a trip and heads each day with its
 * date. The backend's `is_multi_day` answers the same for the printed sheet.
 */
export const isMultiDayTimeline = (
  entries: readonly DayTimelineEntry[],
): boolean => entries.some((entry) => entry.dayOffset !== 0);

/** Whether any point of the plan concerns only the travelling party. */
export const hasTravellersOnlyPoint = (
  runSheet: readonly RunSheetItem[] | null | undefined,
): boolean => (runSheet ?? []).some((item) => item.travellers_only === true);

/**
 * The calendar date a day of the plan falls on, as a `Date` at UTC midnight —
 * a calendar index to format with `timeZone: "UTC"`, never an instant. Counted
 * from the concert's own wall-clock date rather than through an instant, which
 * a DST change or the reader's zone would shift by a day. Null while the
 * concert has no date.
 */
export const planDayDate = (
  concertTime: string | null | undefined,
  dayOffset: number,
): Date | null => {
  const concert = parseLocalInput(concertTime);

  return concert ? new Date((concert.dayIndex + dayOffset) * MS_PER_DAY) : null;
};

/**
 * The instant a project stores, read as the wall clock its venue keeps — the
 * `yyyy-MM-ddTHH:mm` shape every function here parses. It is the one conversion
 * between the two forms: a stored instant sent through the browser's own offset
 * would move the whole day plan by however far the reader is from the choir.
 *
 * The formatting itself belongs to `toZonedWallClock`, which the absence range
 * already reads — this adds only what a stored project needs on top: an ISO
 * string rather than a `Date`, the choir's zone for a row saved before the field
 * was required, and an empty answer for an unusable zone rather than a throw.
 */
export const toWallClockInput = (
  value?: string | null,
  timezone?: string | null,
): string => {
  if (!value) {
    return "";
  }

  try {
    return toZonedWallClock(new Date(value), timezone || DEFAULT_TIMEZONE);
  } catch {
    return "";
  }
};

/**
 * The stored plan, for every surface that displays rather than edits it.
 * Mirrors what the printed sheet does in two steps: the run sheet is sorted
 * here — a manager who typed the plan out of order still reads a clean
 * timeline — and the fixtures are merged into it afterwards without reordering
 * anything.
 */
export const buildProjectDayTimeline = (
  project: Pick<
    Project,
    | "run_sheet"
    | "call_time"
    | "date_time"
    | "timezone"
    | "warmup_start"
    | "warmup_end"
    | "warmup_day"
    | "soundcheck_start"
    | "soundcheck_end"
    | "soundcheck_day"
  >,
): DayTimelineEntry[] =>
  buildDayTimeline({
    runSheet: sortRunSheet(project.run_sheet ?? []),
    callTime: toWallClockInput(project.call_time, project.timezone),
    concertTime: toWallClockInput(project.date_time, project.timezone),
    warmupStart: project.warmup_start,
    warmupEnd: project.warmup_end,
    warmupDay: project.warmup_day,
    soundcheckStart: project.soundcheck_start,
    soundcheckEnd: project.soundcheck_end,
    soundcheckDay: project.soundcheck_day,
  });
