/**
 * @file rehearsalPlan.ts
 * @description The rehearsal plan as a rule, mirrored from the server's
 * `roster/domain/rehearsal_plan.py`: which rows call a given seat, how rows
 * fall into time blocks, and the window one reader is needed for. The editor
 * reads it to put a count on every exclusion chip ("bez B2 · 3 osoby") and a
 * "woła 14 z 22" under every row — both replay the same golden cases the
 * server does (`rehearsal_plan_cases.json`), so the number the conductor sees
 * while excluding is the number of people the server then stops calling.
 * A singer cast on the row's piece answers through that casting; one without
 * a casting is called conservatively, through the section letters a sectional
 * calls them by; a player answers to the rehearsal's flag and the row's; a
 * break calls nobody. A reserve row is not read here at all — it counts
 * toward the window, which promises the worst case.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/rehearsalPlan
 */

import type { Participation, PieceCasting } from "@/shared/types";
import { isInstrumentalist } from "@/shared/lib/voiceTypes";
import {
  sectionLettersOfSeat,
  sectionLettersOfVoiceLine,
} from "@/features/projects/lib/voiceFamilies";

/**
 * The lines a row offers for exclusion when its piece declares none, and the
 * lines a free row offers: the four-part reading an uncast programme has
 * always had. The intermediate lines (MS, CT, BAR) are declared by an
 * arrangement, never implied.
 */
export const CANONICAL_LINES: readonly string[] = [
  "S1", "S2", "S3",
  "A1", "A2", "A3",
  "T1", "T2", "T3",
  "B1", "B2", "B3",
];

/** One row as the rule reads it. `piece` is null for a free row. */
export interface PlanRuleRow {
  readonly piece: string | null;
  /** The conductor's anchor — a clock he promised. */
  readonly startsAt: string | null;
  /** The conductor's estimate of the row's length; clocks follow from it. */
  readonly minutes: number | null;
  /** The lines the exclusions were chosen from — see `rowLines`. */
  readonly lines: ReadonlySet<string>;
  readonly excludedLines: ReadonlySet<string>;
  readonly excludesInstrumentalists: boolean;
  /** Calls nobody, players included; still opens a block when it has a clock. */
  readonly isBreak: boolean;
}

/** One seat as the rule reads it: its section letters, and its line per piece. */
export interface PlanRuleSeat {
  readonly sectionLetters: string;
  readonly isInstrumentalist: boolean;
  readonly castLines: ReadonlyMap<string, string>;
}

/**
 * When one row starts, as far as the plan knows. `clock` is null when nothing
 * fixes it — the row flows under the last clock above it. `derived` is true
 * when the clock follows from minutes (or is the rehearsal's own start).
 */
export interface EffectiveClock {
  readonly clock: string | null;
  readonly derived: boolean;
}

export interface PlanBlock {
  /** The first row always has a clock (its anchor, else the start), so every block does. */
  readonly startsAt: string;
  readonly rows: readonly number[];
}

export interface PlanWindow {
  readonly callsMe: boolean;
  readonly start: string | null;
  readonly end: string | null;
}

/** The lines a row's exclusions are chosen from: declared divisi, or the canonical set. */
export const rowLines = (declared: Iterable<string>): ReadonlySet<string> => {
  const lines = new Set<string>();
  for (const code of declared) if (code) lines.add(code);
  return lines.size > 0 ? lines : new Set(CANONICAL_LINES);
};

/** Whether `row` needs `seat` in the room. */
export const itemCallsSeat = (
  row: PlanRuleRow,
  seat: PlanRuleSeat,
  callsInstrumentalists: boolean,
): boolean => {
  if (row.isBreak) return false;
  if (seat.isInstrumentalist) {
    return callsInstrumentalists && !row.excludesInstrumentalists;
  }
  const castLine = row.piece !== null ? seat.castLines.get(row.piece) : undefined;
  if (castLine) return !row.excludedLines.has(castLine);
  if (seat.sectionLetters === "") return false;
  for (const line of row.lines) {
    if (row.excludedLines.has(line)) continue;
    const letters = sectionLettersOfVoiceLine(line);
    for (const letter of letters) {
      if (seat.sectionLetters.includes(letter)) return true;
    }
  }
  return false;
};

const MINUTES_PER_DAY = 24 * 60;

/** Minutes past midnight of an "HH:MM" wall clock. */
export const clockMinutes = (clock: string): number => {
  const [hours = "0", minutes = "0"] = clock.split(":");
  return Number(hours) * 60 + Number(minutes);
};

/** An "HH:MM" wall clock `minutes` later, wrapping at midnight like the server. */
export const plusMinutes = (clock: string, minutes: number): string => {
  const total = (((clockMinutes(clock) + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Every row's clock, in plan order. An anchor wins — it is the promise, even
 * when the minutes above it add up to later. Otherwise a row starts at the
 * previous row's clock plus the previous row's minutes, when both are known;
 * an unanchored FIRST row starts at the rehearsal's start. Anything else
 * flows under the last clock (`clock: null`) until the next anchor.
 */
export const effectiveClocks = (
  rows: readonly { readonly startsAt: string | null; readonly minutes: number | null }[],
  start: string,
): EffectiveClock[] => {
  const clocks: EffectiveClock[] = [];
  let following: string | null = start;
  for (const row of rows) {
    const entry: EffectiveClock =
      row.startsAt !== null
        ? { clock: row.startsAt, derived: false }
        : following !== null
          ? { clock: following, derived: true }
          : { clock: null, derived: false };
    clocks.push(entry);
    following =
      entry.clock !== null && row.minutes ? plusMinutes(entry.clock, row.minutes) : null;
  }
  return clocks;
};

/**
 * Rows grouped by effective clock, in the order laid out — a row that flows
 * under joins the block above it. Never sorted, so a clock earlier than its
 * predecessor is still the next block (ordering carries the warning).
 */
export const planBlocks = (rows: readonly PlanRuleRow[], start: string): PlanBlock[] => {
  const blocks: PlanBlock[] = [];
  let carried = start;
  let current: number[] = [];
  effectiveClocks(rows, start).forEach((entry, index) => {
    if (entry.clock !== null && entry.clock !== carried) {
      if (current.length > 0) {
        blocks.push({ startsAt: carried, rows: current });
        current = [];
      }
      carried = entry.clock;
    }
    current.push(index);
  });
  if (current.length > 0) blocks.push({ startsAt: carried, rows: current });
  return blocks;
};

/**
 * The part of the evening `seat` is needed for, read off EVERY effective
 * clock — never off the subset a chorister is shown. Opens with the seat's first
 * block and closes with the first block AFTER its last one, else with the
 * rehearsal's end (`null` = never timed). `null` when there is nothing to say:
 * an empty plan, or the whole rehearsal.
 */
export const planWindowForSeat = (
  rows: readonly PlanRuleRow[],
  seat: PlanRuleSeat,
  rehearsal: {
    readonly start: string;
    readonly end: string | null;
    readonly callsInstrumentalists: boolean;
  },
): PlanWindow | null => {
  const blocks = planBlocks(rows, rehearsal.start);
  if (blocks.length === 0) return null;
  const called = rows.map((row) => itemCallsSeat(row, seat, rehearsal.callsInstrumentalists));
  const mine: number[] = [];
  blocks.forEach((block, index) => {
    if (block.rows.some((rowIndex) => called[rowIndex])) mine.push(index);
  });
  if (mine.length === 0) return { callsMe: false, start: null, end: null };

  const first = mine[0];
  const last = mine[mine.length - 1];
  if (first === undefined || last === undefined) return null;
  const firstBlock = blocks[first];
  if (!firstBlock) return null;
  const windowStart = firstBlock.startsAt;
  const followingBlock = blocks[last + 1];
  const windowEnd = followingBlock ? followingBlock.startsAt : rehearsal.end;
  if (windowStart === rehearsal.start && windowEnd === rehearsal.end) return null;
  return { callsMe: true, start: windowStart, end: windowEnd };
};

/**
 * Which clock each row shows a reader: the choir is told promises, not the
 * budget. A reader with a seat reading (`calls_me` answered on the rows) sees
 * the anchors, plus the clock where they arrive (the block their first called
 * row falls in) and the one where they are released (the next clock after
 * their last called row) — a gap in the middle is not a release. A reader
 * with no reading (staff: `calls_me` null everywhere) sees every clock.
 * Display only: the window is computed server-side from EVERY clock.
 */
export const shownClocks = (
  rows: readonly {
    readonly clock: string | null;
    readonly clock_derived: boolean;
    readonly calls_me?: boolean | null;
  }[],
): (string | null)[] => {
  const personal = rows.some((row) => typeof row.calls_me === "boolean");
  if (!personal) return rows.map((row) => row.clock);
  const firstCalled = rows.findIndex((row) => row.calls_me === true);
  let lastCalled = -1;
  rows.forEach((row, index) => {
    if (row.calls_me === true) lastCalled = index;
  });
  let arrival = -1;
  for (let index = firstCalled; index >= 0; index -= 1) {
    if (rows[index]?.clock) {
      arrival = index;
      break;
    }
  }
  const release =
    lastCalled === -1
      ? -1
      : rows.findIndex((row, index) => index > lastCalled && row.clock !== null);
  return rows.map((row, index) => {
    if (row.clock === null) return null;
    if (!row.clock_derived || index === arrival || index === release) return row.clock;
    return null;
  });
};

/* ── From the panel's own payloads to the rule's shapes ──────────────────── */

/**
 * A seat from a participation and the project's casting board. `castings`
 * carries every seat's rows; only this seat's are read.
 */
export const planSeatOf = (
  participation: Pick<Participation, "id" | "artist_voice_type" | "default_voice_line">,
  castings: readonly Pick<PieceCasting, "participation" | "piece" | "voice_line">[],
): PlanRuleSeat => {
  const castLines = new Map<string, string>();
  const seatId = String(participation.id);
  for (const casting of castings) {
    if (String(casting.participation) === seatId) {
      castLines.set(String(casting.piece), casting.voice_line);
    }
  }
  return {
    sectionLetters: sectionLettersOfSeat(
      participation.artist_voice_type ?? null,
      participation.default_voice_line ?? null,
    ),
    isInstrumentalist: isInstrumentalist(participation.artist_voice_type),
    castLines,
  };
};

/**
 * A rule row from a saved or drafted plan row. `declaredLines` are the piece's
 * divisi as the programme binds them (the explicit edition only — the server
 * consults nothing else); ignored for a free row.
 */
export const planRowOf = (
  item: {
    readonly piece: string | null;
    readonly starts_at: string | null;
    readonly minutes: number | null;
    readonly excluded_voice_lines: readonly string[];
    readonly excludes_instrumentalists: boolean;
    readonly is_break: boolean;
  },
  declaredLines: Iterable<string>,
): PlanRuleRow => ({
  piece: item.piece,
  startsAt: item.starts_at,
  minutes: item.minutes,
  lines: rowLines(item.piece === null ? [] : declaredLines),
  excludedLines: new Set(item.excluded_voice_lines),
  excludesInstrumentalists: item.excludes_instrumentalists,
  isBreak: item.is_break,
});
