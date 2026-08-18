/**
 * @file dayTimeline.ts
 * @description Concert-day arithmetic for the run sheet: it merges the fixed
 * moments a producer plans around — the call time, the downbeat, and the two
 * typed windows (warm-up, sound check) — with the editable points between them
 * into one chronological list.
 * The run sheet stores bare `HH:mm`, so the concert day is its implicit frame;
 * an anchor that falls on another day therefore carries a day offset and is
 * placed by it. Ordering is the only warning this needs: a point that lands
 * before the call or after the downbeat simply renders outside the anchors.
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
  /** Wall-clock time on concert day — the run sheet's own frame. */
  readonly time: string;
  /** Closing hour where one is set; an open window is the normal case. */
  readonly endTime: string | null;
}

export interface DayTimelinePoint {
  readonly kind: "point";
  readonly item: RunSheetItem;
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

/**
 * Chronological order for stored run-sheet rows, for the two places that settle
 * the day rather than display it (load and commit). Compared on the parsed
 * minute, never on the string: lexically `"9:00"` follows `"12:00"`. An
 * unreadable time sorts last, keeping its input order behind a stable sort.
 */
export const compareRunSheetTimes = (left: string, right: string): number => {
  const leftMinutes = parseClockTime(left);
  const rightMinutes = parseClockTime(right);

  if (leftMinutes === null || rightMinutes === null) {
    return Number(leftMinutes === null) - Number(rightMinutes === null);
  }

  return leftMinutes - rightMinutes;
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

/**
 * A window is a wall-clock time on concert day — the same frame the run sheet
 * uses — so it has no offset to carry; only an anchor can sit on another date.
 */
const fixtureSortKey = (fixture: DayTimelineFixture): number =>
  (isDayWindow(fixture) ? 0 : fixture.dayOffset) * MINUTES_PER_DAY +
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
): DayTimelineWindow | null => {
  const time = readWallClock(start);

  return time === null ? null : { kind, time, endTime: readWallClock(end) };
};

export interface DayTimelineInput {
  readonly runSheet: readonly RunSheetItem[];
  readonly callTime?: string | null;
  readonly concertTime?: string | null;
  readonly warmupStart?: string | null;
  readonly warmupEnd?: string | null;
  readonly soundcheckStart?: string | null;
  readonly soundcheckEnd?: string | null;
}

/**
 * Merges the fixtures INTO the run sheet without reordering it. The points
 * arrive in the order the caller settled on (see `useDetailsForm`, which sorts
 * on commit rather than on keystroke, so a half-typed time cannot yank the row
 * being edited to the top of the day; stored days are sorted by
 * `buildProjectDayTimeline`).
 */
export const buildDayTimeline = ({
  runSheet,
  callTime,
  concertTime,
  warmupStart,
  warmupEnd,
  soundcheckStart,
  soundcheckEnd,
}: DayTimelineInput): DayTimelineEntry[] => {
  const concertDayIndex = parseLocalInput(concertTime)?.dayIndex ?? null;

  // Listed in the order two fixtures of the same minute should read; a stable
  // sort is what makes that order the tie-break.
  const fixtures = [
    buildAnchor("call", callTime, concertDayIndex),
    buildWindow("warmup", warmupStart, warmupEnd),
    buildWindow("soundcheck", soundcheckStart, soundcheckEnd),
    buildAnchor("concert", concertTime, concertDayIndex),
  ]
    .filter((fixture): fixture is DayTimelineFixture => fixture !== null)
    .sort((left, right) => fixtureSortKey(left) - fixtureSortKey(right));

  // An unset time inherits its predecessor's position, so a row mid-edit stays
  // between the same neighbours instead of collapsing to the start of the day.
  let carried = 0;
  const pointKeys = runSheet.map((item) => {
    carried = parseClockTime(item.time) ?? carried;
    return carried;
  });

  const entries: DayTimelineEntry[] = [];
  let nextFixture = 0;

  runSheet.forEach((item, index) => {
    while (
      nextFixture < fixtures.length &&
      fixtureSortKey(fixtures[nextFixture]) < pointKeys[index]
    ) {
      entries.push(fixtures[nextFixture]);
      nextFixture += 1;
    }

    entries.push({ kind: "point", item });
  });

  return [...entries, ...fixtures.slice(nextFixture)];
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
 * The stored day, for every surface that displays rather than edits it. Mirrors
 * what the printed sheet does in two steps: the run sheet is sorted here — a
 * manager who typed the day out of order still reads a clean timeline — and the
 * fixtures are merged into it afterwards without reordering anything.
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
    | "soundcheck_start"
    | "soundcheck_end"
  >,
): DayTimelineEntry[] =>
  buildDayTimeline({
    runSheet: [...(project.run_sheet ?? [])].sort((left, right) =>
      compareRunSheetTimes(left.time || "", right.time || ""),
    ),
    callTime: toWallClockInput(project.call_time, project.timezone),
    concertTime: toWallClockInput(project.date_time, project.timezone),
    warmupStart: project.warmup_start,
    warmupEnd: project.warmup_end,
    soundcheckStart: project.soundcheck_start,
    soundcheckEnd: project.soundcheck_end,
  });
