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
  readonly startsAt: string | null;
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

export interface PlanBlock {
  /** Null only for the rows before the first clock — the rehearsal's own start. */
  readonly startsAt: string | null;
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

/**
 * Rows grouped by effective clock, in the order laid out — never sorted, so a
 * clock earlier than its predecessor is still the next block (ordering
 * carries the warning).
 */
export const planBlocks = (rows: readonly PlanRuleRow[]): PlanBlock[] => {
  const blocks: PlanBlock[] = [];
  let carried: string | null = null;
  let current: number[] = [];
  rows.forEach((row, index) => {
    if (row.startsAt !== null && row.startsAt !== carried) {
      if (current.length > 0) {
        blocks.push({ startsAt: carried, rows: current });
        current = [];
      }
      carried = row.startsAt;
    }
    current.push(index);
  });
  if (current.length > 0) blocks.push({ startsAt: carried, rows: current });
  return blocks;
};

/**
 * The part of the evening `seat` is needed for. Opens with the seat's first
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
  const blocks = planBlocks(rows);
  if (blocks.length === 0) return null;
  const called = rows.map((row) => itemCallsSeat(row, seat, rehearsal.callsInstrumentalists));
  const mine: number[] = [];
  blocks.forEach((block, index) => {
    if (block.rows.some((rowIndex) => called[rowIndex])) mine.push(index);
  });
  if (mine.length === 0) return { callsMe: false, start: null, end: null };

  const clock = (block: PlanBlock): string => block.startsAt ?? rehearsal.start;
  const first = mine[0];
  const last = mine[mine.length - 1];
  if (first === undefined || last === undefined) return null;
  const firstBlock = blocks[first];
  if (!firstBlock) return null;
  const windowStart = clock(firstBlock);
  const followingBlock = blocks[last + 1];
  const windowEnd = followingBlock ? clock(followingBlock) : rehearsal.end;
  if (windowStart === rehearsal.start && windowEnd === rehearsal.end) return null;
  return { callsMe: true, start: windowStart, end: windowEnd };
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
 * consults nothing else); ignored for a free row. A row that does not say
 * `is_break` is not a break.
 */
export const planRowOf = (
  item: {
    readonly piece: string | null;
    readonly starts_at: string | null;
    readonly excluded_voice_lines: readonly string[];
    readonly excludes_instrumentalists: boolean;
    readonly is_break?: boolean;
  },
  declaredLines: Iterable<string>,
): PlanRuleRow => ({
  piece: item.piece,
  startsAt: item.starts_at,
  lines: rowLines(item.piece === null ? [] : declaredLines),
  excludedLines: new Set(item.excluded_voice_lines),
  excludesInstrumentalists: item.excludes_instrumentalists,
  isBreak: item.is_break ?? false,
});
