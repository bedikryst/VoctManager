/**
 * @file usePlanEditor.ts
 * @description The brain of the plan editor: a draft of the rows baselined on
 * the server's plan, the edits a conductor makes to it (add, reorder, retime,
 * exclude, remove), the three fills that spare him laying the evening out
 * from zero (the whole programme; what the previous rehearsal left undone; a
 * copy of any other rehearsal's plan), and — for every row and every chip —
 * the number of people the exclusion actually removes, computed by the same
 * rule the server calls with (`lib/rehearsalPlan`), and every row's effective
 * clock from its anchor and the minutes above it. Nothing here talks to the
 * network beyond the one whole-list save; the draft is local until then.
 *
 * The reserve ("Jeśli starczy czasu") is a divider in the list, not a flag on
 * a row: the draft holds where the divider stands, and `is_reserve` is derived
 * from that position only when the list is sent. A per-row flag would let a
 * drag put a main row under a reserve one, which the server refuses whole.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/usePlanEditor
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { formatInTimeZone } from "date-fns-tz";

import type {
  Piece,
  ProgramItem,
  Rehearsal,
  RehearsalPlanItem,
  VoiceLine,
} from "@/shared/types";
import { scopedToEdition } from "@/features/archive/constants/divisiScope";
import { voiceFamilyOf, type VoiceFamilyId } from "@/features/projects/lib/voiceFamilies";
import { resolveInvited } from "../../lib/attendanceStats";
import {
  clockMinutes,
  effectiveClocks,
  itemCallsSeat,
  planRowOf,
  planSeatOf,
  type EffectiveClock,
  type PlanRuleRow,
} from "../../lib/rehearsalPlan";
import type { RehearsalPlanRead, RehearsalPlanRowDTO } from "../../types/rehearsalPlan.dto";
import type { PlanEditorData } from "./usePlanEditorData";

/** The sortable id of the reserve divider — never a row's key (those are UUIDs). */
export const RESERVE_DIVIDER_KEY = "plan-reserve-divider";

/** One row of the draft. `key` is the client's handle; `id` the server's, when saved. */
export interface PlanDraftRow {
  readonly key: string;
  readonly id: string | null;
  readonly piece: string | null;
  readonly label: string;
  readonly note: string;
  /** An anchor: a clock the conductor promised. Null = derived from minutes, or flowing. */
  readonly starts_at: string | null;
  /** The conductor's estimate; it survives a drag where a typed clock would not. */
  readonly minutes: number | null;
  readonly excluded_voice_lines: readonly VoiceLine[];
  readonly excludes_instrumentalists: boolean;
  /** Calls nobody: no piece, no exclusions. Fixed when the row is added. */
  readonly is_break: boolean;
}

/** The rows in order, and the index the reserve starts at (`rows.length` = no reserve). */
interface PlanDraft {
  readonly rows: readonly PlanDraftRow[];
  readonly reserveStart: number;
}

/** One line a row offers for exclusion, with what excluding it costs. */
export interface ExclusionLine {
  readonly line: VoiceLine;
  readonly family: VoiceFamilyId;
  readonly excluded: boolean;
  /** Seats this chip removes (when excluded) or would remove (when not). */
  readonly removes: number;
}

/** A family toggle: every line of one voice at once ("Alty" = all A-lines). */
export interface ExclusionFamily {
  readonly family: VoiceFamilyId;
  readonly lines: readonly ExclusionLine[];
  /** All of the family's lines are excluded. */
  readonly excluded: boolean;
  /** Seats the whole family would remove, on top of the current exclusions. */
  readonly removes: number;
}

export interface PlanRowReading {
  readonly key: string;
  /** The piece's title, or the label — what the row is. */
  readonly title: string;
  /** Seats this row calls, out of those the rehearsal calls. */
  readonly called: number;
  readonly families: readonly ExclusionFamily[];
  /** Whether the rehearsal calls a player this row could stand down. */
  readonly offersInstrumentalists: boolean;
  /** Players the instrumentalist flag removes (or would). */
  readonly instrumentalistsRemoved: number;
  readonly hasExclusions: boolean;
}

/** A rehearsal a fill can copy from, as the picker lists it. */
export interface PlanSource {
  readonly rehearsalId: string;
  readonly dateTime: string;
  readonly timezone: string;
  readonly focus: string;
  readonly rowCount: number;
}

export interface PlanEditor {
  readonly rows: readonly PlanDraftRow[];
  /** Rows from this index on are reserve; equal to `rows.length` when none are. */
  readonly reserveStart: number;
  /** Every row's effective clock, by row key — the rule the server derives with. */
  readonly clocks: ReadonlyMap<string, EffectiveClock>;
  /**
   * The row the "end of rehearsal" line stands above: the first row the
   * evening cannot fit. Null when everything fits, or the evening is untimed.
   */
  readonly endLineBefore: string | null;
  /** The rehearsal's end as a wall clock; null when it was never timed. */
  readonly endClock: string | null;
  readonly readings: ReadonlyMap<string, PlanRowReading>;
  /** Seats the rehearsal calls — the denominator under every row. */
  readonly calledTotal: number;
  readonly isDirty: boolean;
  readonly programOptions: readonly { readonly value: string; readonly label: string }[];
  readonly sources: readonly PlanSource[];
  /** The previous rehearsal by date, when it left rows undone. */
  readonly carryOver: { readonly source: PlanSource; readonly undone: number } | null;
  readonly addPieceRow: (pieceId: string) => void;
  readonly addFreeRow: () => void;
  /** Adds a break above the divider, labelled with the caller's localized word. */
  readonly addBreakRow: (label: string) => void;
  readonly updateRow: (
    key: string,
    patch: Partial<Omit<PlanDraftRow, "key" | "id" | "is_break">>,
  ) => void;
  /** Turns a row's derived clock into an anchor at the same time. */
  readonly anchorRow: (key: string) => void;
  readonly toggleLine: (key: string, line: VoiceLine) => void;
  readonly toggleFamily: (key: string, family: VoiceFamilyId) => void;
  readonly removeRow: (key: string) => void;
  /** Moves a row or the divider (`RESERVE_DIVIDER_KEY`) onto another's place. */
  readonly moveRow: (fromKey: string, toKey: string) => void;
  readonly fillProgram: () => void;
  readonly fillCarryOver: () => void;
  readonly copyFrom: (rehearsalId: string) => void;
  readonly reset: () => void;
  readonly toDTO: () => RehearsalPlanRowDTO[];
}

const makeKey = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const blankRow = (patch: Partial<Omit<PlanDraftRow, "key" | "id">>): PlanDraftRow => ({
  key: makeKey(),
  id: null,
  piece: null,
  label: "",
  note: "",
  starts_at: null,
  minutes: null,
  excluded_voice_lines: [],
  excludes_instrumentalists: false,
  is_break: false,
  ...patch,
});

const draftRowOf = (item: RehearsalPlanItem): PlanDraftRow => ({
  key: item.id,
  id: item.id,
  piece: item.piece,
  label: item.label,
  note: item.note,
  starts_at: item.starts_at,
  minutes: item.minutes,
  excluded_voice_lines: item.excluded_voice_lines,
  excludes_instrumentalists: item.excludes_instrumentalists,
  is_break: item.is_break,
});

/** The server's rows as a draft: the divider stands before the first reserve row. */
const draftOf = (items: readonly RehearsalPlanItem[]): PlanDraft => {
  const firstReserve = items.findIndex((item) => item.is_reserve);
  return {
    rows: items.map(draftRowOf),
    reserveStart: firstReserve === -1 ? items.length : firstReserve,
  };
};

/**
 * A copied row: same content and minutes, no anchor, no verdict, no server
 * identity. The estimate of a piece's length travels between evenings; a
 * clock promised for one evening does not.
 */
const copyOf = (item: RehearsalPlanItem): PlanDraftRow =>
  blankRow({
    piece: item.piece,
    label: item.label,
    note: item.note,
    minutes: item.minutes,
    excluded_voice_lines: item.excluded_voice_lines,
    excludes_instrumentalists: item.excludes_instrumentalists,
    is_break: item.is_break,
  });

const rowDTO = (row: PlanDraftRow, isReserve: boolean): RehearsalPlanRowDTO => ({
  ...(row.id ? { id: row.id } : {}),
  piece: row.piece,
  label: row.piece ? "" : row.label.trim(),
  note: row.note.trim(),
  starts_at: row.starts_at || null,
  minutes: row.minutes && row.minutes > 0 ? row.minutes : null,
  excluded_voice_lines: [...row.excluded_voice_lines],
  excludes_instrumentalists: row.excludes_instrumentalists,
  is_reserve: isReserve,
  is_break: row.is_break,
});

const draftDTO = (draft: PlanDraft): RehearsalPlanRowDTO[] =>
  draft.rows.map((row, index) => rowDTO(row, index >= draft.reserveStart));

/**
 * The order and content a save would send, without the server identities —
 * what "dirty" compares. Identity is left out on purpose: a save answers with
 * the same rows now carrying ids, and that answer must read as clean. The
 * divider is in it through `is_reserve`; a divider standing under the last
 * row and no divider at all are the same plan.
 */
const fingerprint = (draft: PlanDraft): string =>
  JSON.stringify(
    draftDTO(draft).map((row) => {
      const { id: _id, ...content } = row;
      return content;
    }),
  );

/** New rows go in above the divider: the reserve is something a row is dragged into. */
const insertMain = (draft: PlanDraft, added: readonly PlanDraftRow[]): PlanDraft => ({
  rows: [
    ...draft.rows.slice(0, draft.reserveStart),
    ...added,
    ...draft.rows.slice(draft.reserveStart),
  ],
  reserveStart: draft.reserveStart + added.length,
});

const mapRows = (
  draft: PlanDraft,
  map: (row: PlanDraftRow) => PlanDraftRow,
): PlanDraft => ({ ...draft, rows: draft.rows.map(map) });

const FAMILY_ORDER: readonly VoiceFamilyId[] = ["S", "MS", "A", "CT", "T", "BAR", "B", "V", "ROLE"];

export const usePlanEditor = (
  rehearsal: Rehearsal,
  serverPlan: RehearsalPlanRead | undefined,
  data: PlanEditorData,
): PlanEditor => {
  const serverRows = useMemo(() => serverPlan?.rows ?? [], [serverPlan]);
  const [draft, setDraft] = useState<PlanDraft>(() => draftOf(serverRows));
  const baseline = useRef(fingerprint(draftOf(serverRows)));
  const isDirty = fingerprint(draft) !== baseline.current;
  const { rows, reserveStart } = draft;

  // A fresh server answer (a save, a refetch) re-baselines the draft, and
  // replaces it when the draft says the same thing — which is how the rows a
  // save just created pick up their ids. Mid-edit, the conductor's rows win
  // and the baseline moves under them, so the save bar still knows there is
  // something to send.
  //
  // Before the first answer there is nothing to protect: the empty draft is a
  // placeholder, not a decision. A row added while `GET plan/` is still in
  // flight would otherwise keep the stored rows out of the draft for good, and
  // the next save — which replaces the whole list — would delete them.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baselined = useRef(false);
  useEffect(() => {
    const next = draftOf(serverRows);
    const nextFingerprint = fingerprint(next);
    const wasClean = fingerprint(draftRef.current) === baseline.current;
    baseline.current = nextFingerprint;
    if (!baselined.current || wasClean || fingerprint(draftRef.current) === nextFingerprint) {
      setDraft(next);
    }
    if (serverPlan !== undefined) baselined.current = true;
  }, [serverRows, serverPlan]);

  /* ── Programme and pieces ─────────────────────────────────────────────── */

  const program = useMemo(
    () => [...data.program].sort((a, b) => a.order - b.order),
    [data.program],
  );
  const programByPiece = useMemo(() => {
    const map = new Map<string, ProgramItem>();
    for (const item of program) map.set(String(item.piece), item);
    return map;
  }, [program]);
  const pieceById = useMemo(() => {
    const map = new Map<string, Piece>();
    for (const piece of data.pieces) map.set(String(piece.id), piece);
    return map;
  }, [data.pieces]);

  /** The lines a piece row offers: declared through the programme's explicit
   *  edition, exactly as the server reads them; empty = canonical. */
  const declaredLinesOf = useCallback(
    (pieceId: string): VoiceLine[] => {
      const piece = pieceById.get(pieceId);
      const item = programByPiece.get(pieceId);
      if (!piece) return [];
      const seen = new Set<VoiceLine>();
      for (const requirement of scopedToEdition(
        piece.voice_requirements_read ?? [],
        item?.score_edition ?? null,
      )) {
        seen.add(requirement.voice_line);
      }
      return [...seen];
    },
    [pieceById, programByPiece],
  );

  const titleOf = useCallback(
    (row: PlanDraftRow): string => {
      if (row.piece === null) return row.label;
      return (
        programByPiece.get(row.piece)?.piece_title ??
        pieceById.get(row.piece)?.title ??
        ""
      );
    },
    [programByPiece, pieceById],
  );

  const programOptions = useMemo(
    () =>
      program.map((item) => ({
        value: String(item.piece),
        label: item.piece_title ?? pieceById.get(String(item.piece))?.title ?? "",
      })),
    [program, pieceById],
  );

  /* ── Seats the rehearsal calls ───────────────────────────────────────── */

  const seats = useMemo(() => {
    const invited = new Set((rehearsal.invited_participations ?? []).map(String));
    return resolveInvited(rehearsal, data.participations).map((participation) => ({
      seat: planSeatOf(participation, data.castings),
      // A player named on the list is called as if the flag were set — the
      // list is the call.
      callsPlayers:
        Boolean(rehearsal.calls_instrumentalists) || invited.has(String(participation.id)),
    }));
  }, [rehearsal, data.participations, data.castings]);

  const countCalled = useCallback(
    (row: PlanRuleRow): number =>
      seats.reduce(
        (count, { seat, callsPlayers }) =>
          itemCallsSeat(row, seat, callsPlayers) ? count + 1 : count,
        0,
      ),
    [seats],
  );

  const offersInstrumentalists = useMemo(
    () => seats.some(({ seat, callsPlayers }) => seat.isInstrumentalist && callsPlayers),
    [seats],
  );

  const readings = useMemo(() => {
    const map = new Map<string, PlanRowReading>();
    for (const row of rows) {
      // A break calls nobody and offers nothing to exclude.
      if (row.is_break) {
        map.set(row.key, {
          key: row.key,
          title: titleOf(row),
          called: 0,
          families: [],
          offersInstrumentalists: false,
          instrumentalistsRemoved: 0,
          hasExclusions: false,
        });
        continue;
      }
      const declared = row.piece === null ? [] : declaredLinesOf(row.piece);
      const rule = planRowOf(row, declared);
      const called = countCalled(rule);
      const excluded = new Set<string>(row.excluded_voice_lines);

      const withExcluded = (lines: ReadonlySet<string>): PlanRuleRow => ({
        ...rule,
        excludedLines: lines,
      });
      const removedBy = (line: string): number => {
        const without = new Set(excluded);
        without.delete(line);
        const with_ = new Set(excluded);
        with_.add(line);
        return countCalled(withExcluded(without)) - countCalled(withExcluded(with_));
      };

      const byFamily = new Map<VoiceFamilyId, ExclusionLine[]>();
      for (const line of [...rule.lines].sort()) {
        const family = voiceFamilyOf(line);
        const entry: ExclusionLine = {
          line: line as VoiceLine,
          family,
          excluded: excluded.has(line),
          removes: removedBy(line),
        };
        const bucket = byFamily.get(family);
        if (bucket) bucket.push(entry);
        else byFamily.set(family, [entry]);
      }
      const families: ExclusionFamily[] = FAMILY_ORDER.flatMap((family) => {
        const lines = byFamily.get(family);
        if (!lines) return [];
        const allExcluded = lines.every((line) => line.excluded);
        const without = new Set(excluded);
        const with_ = new Set(excluded);
        for (const line of lines) {
          without.delete(line.line);
          with_.add(line.line);
        }
        return [
          {
            family,
            lines,
            excluded: allExcluded,
            removes: countCalled(withExcluded(without)) - countCalled(withExcluded(with_)),
          },
        ];
      });

      const instrumentalistsRemoved = offersInstrumentalists
        ? countCalled({ ...rule, excludesInstrumentalists: false }) -
          countCalled({ ...rule, excludesInstrumentalists: true })
        : 0;

      map.set(row.key, {
        key: row.key,
        title: titleOf(row),
        called,
        families,
        offersInstrumentalists,
        instrumentalistsRemoved,
        hasExclusions: excluded.size > 0 || row.excludes_instrumentalists,
      });
    }
    return map;
  }, [rows, declaredLinesOf, countCalled, offersInstrumentalists, titleOf]);

  /* ── Clocks ──────────────────────────────────────────────────────────── */

  // The rehearsal's start and end as the wall clock its zone keeps — the
  // same "HH:MM" the rows' anchors are written in.
  const startClock = useMemo(
    () => formatInTimeZone(rehearsal.date_time, rehearsal.timezone, "HH:mm"),
    [rehearsal.date_time, rehearsal.timezone],
  );
  const endClock = useMemo(
    () =>
      rehearsal.duration_minutes && rehearsal.end_date_time
        ? formatInTimeZone(rehearsal.end_date_time, rehearsal.timezone, "HH:mm")
        : null,
    [rehearsal.duration_minutes, rehearsal.end_date_time, rehearsal.timezone],
  );

  const clocks = useMemo(() => {
    const entries = effectiveClocks(
      rows.map((row) => ({ startsAt: row.starts_at || null, minutes: row.minutes })),
      startClock,
    );
    const map = new Map<string, EffectiveClock>();
    rows.forEach((row, index) => {
      const entry = entries[index];
      if (entry) map.set(row.key, entry);
    });
    return map;
  }, [rows, startClock]);

  // The first row that does not fit whole: it starts at or after the end, or
  // its minutes run past it. Ordering carries the warning — no copy, no
  // validation. An evening that crosses midnight reads its small-hour clocks
  // as the next day; one that does not reads an anchor before the start as
  // simply early.
  const endLineBefore = useMemo(() => {
    if (endClock === null) return null;
    const startMinutes = clockMinutes(startClock);
    const crossesMidnight = clockMinutes(endClock) < startMinutes;
    const onEvening = (clock: string): number => {
      const minutes = clockMinutes(clock);
      return crossesMidnight && minutes < startMinutes ? minutes + 24 * 60 : minutes;
    };
    const end = onEvening(endClock);
    for (const row of rows) {
      const clock = clocks.get(row.key)?.clock;
      if (!clock) continue;
      const at = onEvening(clock);
      if (at >= end || (row.minutes !== null && at + row.minutes > end)) return row.key;
    }
    return null;
  }, [endClock, startClock, rows, clocks]);

  /* ── Sources for the fills ───────────────────────────────────────────── */

  const sources = useMemo<PlanSource[]>(
    () =>
      data.rehearsals
        .filter(
          (other) =>
            String(other.id) !== String(rehearsal.id) && (other.plan?.length ?? 0) > 0,
        )
        .sort((a, b) => b.date_time.localeCompare(a.date_time))
        .map((other) => ({
          rehearsalId: String(other.id),
          dateTime: other.date_time,
          timezone: other.timezone,
          focus: other.focus?.trim() ?? "",
          rowCount: other.plan?.length ?? 0,
        })),
    [data.rehearsals, rehearsal.id],
  );

  /** A plan's rows that can still be planned: a piece since dropped from the
   *  programme would make the server refuse the whole save for one stale row. */
  const plannableRowsOf = useCallback(
    (rehearsalId: string): RehearsalPlanItem[] =>
      (data.rehearsals.find((other) => String(other.id) === rehearsalId)?.plan ?? []).filter(
        (item) => item.piece === null || programByPiece.has(item.piece),
      ),
    [data.rehearsals, programByPiece],
  );

  // What the previous evening did not get to: rows the server reads as not
  // done. `done` stays null until an evening is over, so one not held yet
  // offers nothing; a break is never "undone".
  const undoneOf = useCallback(
    (rehearsalId: string): RehearsalPlanItem[] =>
      plannableRowsOf(rehearsalId).filter((item) => item.done === false && !item.is_break),
    [plannableRowsOf],
  );

  const carryOver = useMemo(() => {
    const previous = data.rehearsals
      .filter(
        (other) =>
          String(other.id) !== String(rehearsal.id) && other.date_time < rehearsal.date_time,
      )
      .sort((a, b) => b.date_time.localeCompare(a.date_time))[0];
    if (!previous) return null;
    const undone = undoneOf(String(previous.id));
    if (undone.length === 0) return null;
    const source = sources.find((candidate) => candidate.rehearsalId === String(previous.id));
    return source ? { source, undone: undone.length } : null;
  }, [data.rehearsals, rehearsal.id, rehearsal.date_time, undoneOf, sources]);

  /* ── Edits ───────────────────────────────────────────────────────────── */

  const addPieceRow = useCallback((pieceId: string) => {
    setDraft((current) => insertMain(current, [blankRow({ piece: pieceId })]));
  }, []);

  const addFreeRow = useCallback(() => {
    setDraft((current) => insertMain(current, [blankRow({})]));
  }, []);

  const addBreakRow = useCallback((label: string) => {
    setDraft((current) => insertMain(current, [blankRow({ label, is_break: true })]));
  }, []);

  const updateRow = useCallback<PlanEditor["updateRow"]>((key, patch) => {
    setDraft((current) =>
      mapRows(current, (row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        // Exclusions are chosen from the piece's own lines; a new piece
        // offers a new set, so the old choice cannot carry over.
        if (patch.piece !== undefined && patch.piece !== row.piece) {
          return { ...next, excluded_voice_lines: [] };
        }
        return next;
      }),
    );
  }, []);

  // A tap on a derived clock promises it: the row keeps that time through
  // every later drag. Clearing the anchor (`starts_at: null`) hands the row
  // back to its minutes.
  const anchorRow = useCallback(
    (key: string) => {
      const clock = clocks.get(key)?.clock;
      if (clock) updateRow(key, { starts_at: clock });
    },
    [clocks, updateRow],
  );

  const toggleLine = useCallback((key: string, line: VoiceLine) => {
    setDraft((current) =>
      mapRows(current, (row) => {
        if (row.key !== key) return row;
        const excluded = new Set(row.excluded_voice_lines);
        if (excluded.has(line)) excluded.delete(line);
        else excluded.add(line);
        return { ...row, excluded_voice_lines: [...excluded] };
      }),
    );
  }, []);

  const toggleFamily = useCallback(
    (key: string, family: VoiceFamilyId) => {
      const reading = readings.get(key);
      const target = reading?.families.find((entry) => entry.family === family);
      if (!target) return;
      setDraft((current) =>
        mapRows(current, (row) => {
          if (row.key !== key) return row;
          const excluded = new Set(row.excluded_voice_lines);
          for (const line of target.lines) {
            if (target.excluded) excluded.delete(line.line);
            else excluded.add(line.line);
          }
          return { ...row, excluded_voice_lines: [...excluded] };
        }),
      );
    },
    [readings],
  );

  const removeRow = useCallback((key: string) => {
    setDraft((current) => {
      const index = current.rows.findIndex((row) => row.key === key);
      if (index === -1) return current;
      return {
        rows: current.rows.filter((row) => row.key !== key),
        reserveStart: index < current.reserveStart ? current.reserveStart - 1 : current.reserveStart,
      };
    });
  }, []);

  // The divider sorts like a row: the list is laid out with it in place, moved
  // as one sequence, and the divider's new index is where the reserve starts.
  const moveRow = useCallback((fromKey: string, toKey: string) => {
    setDraft((current) => {
      const keys = current.rows.map((row) => row.key);
      keys.splice(current.reserveStart, 0, RESERVE_DIVIDER_KEY);
      const from = keys.indexOf(fromKey);
      const to = keys.indexOf(toKey);
      if (from === -1 || to === -1 || from === to) return current;
      const moved = arrayMove(keys, from, to);
      const byKey = new Map(current.rows.map((row) => [row.key, row]));
      return {
        rows: moved.flatMap((key) => {
          const row = byKey.get(key);
          return row ? [row] : [];
        }),
        reserveStart: moved.indexOf(RESERVE_DIVIDER_KEY),
      };
    });
  }, []);

  /* ── Fills ───────────────────────────────────────────────────────────── */

  const fillProgram = useCallback(() => {
    setDraft((current) => {
      const present = new Set(current.rows.map((row) => row.piece).filter(Boolean));
      const added = program
        .filter((item) => !present.has(String(item.piece)))
        .map((item) => blankRow({ piece: String(item.piece) }));
      return insertMain(current, added);
    });
  }, [program]);

  // Last week's reserve is this week's due: everything carried lands above
  // the divider, whichever side of it the row stood on.
  const fillCarryOver = useCallback(() => {
    if (!carryOver) return;
    const copied = undoneOf(carryOver.source.rehearsalId).map(copyOf);
    setDraft((current) => insertMain(current, copied));
  }, [carryOver, undoneOf]);

  // A copy keeps each row's side of the divider: the source's main rows join
  // the main part, its reserve rows the end of the reserve.
  const copyFrom = useCallback(
    (rehearsalId: string) => {
      const source = plannableRowsOf(rehearsalId);
      const main = source.filter((item) => !item.is_reserve).map(copyOf);
      const reserve = source.filter((item) => item.is_reserve).map(copyOf);
      setDraft((current) => {
        const withMain = insertMain(current, main);
        return { ...withMain, rows: [...withMain.rows, ...reserve] };
      });
    },
    [plannableRowsOf],
  );

  const reset = useCallback(() => {
    setDraft(draftOf(serverRows));
  }, [serverRows]);

  const toDTO = useCallback(() => draftDTO(draft), [draft]);

  return {
    rows,
    reserveStart,
    clocks,
    endLineBefore,
    endClock,
    readings,
    calledTotal: seats.length,
    isDirty,
    programOptions,
    sources,
    carryOver,
    addPieceRow,
    addFreeRow,
    addBreakRow,
    updateRow,
    anchorRow,
    toggleLine,
    toggleFamily,
    removeRow,
    moveRow,
    fillProgram,
    fillCarryOver,
    copyFrom,
    reset,
    toDTO,
  };
};
