/**
 * @file usePlanEditor.ts
 * @description The brain of the plan editor: a draft of the rows baselined on
 * the server's plan, the edits a conductor makes to it (add, reorder, retime,
 * exclude, remove), the three fills that spare him laying the evening out
 * from zero (the whole programme; what the previous rehearsal left undone; a
 * copy of any other rehearsal's plan), and — for every row and every chip —
 * the number of people the exclusion actually removes, computed by the same
 * rule the server calls with (`lib/rehearsalPlan`). Nothing here talks to the
 * network beyond the one whole-list save; the draft is local until then.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/usePlanEditor
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";

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
  itemCallsSeat,
  planRowOf,
  planSeatOf,
  type PlanRuleRow,
} from "../../lib/rehearsalPlan";
import type { RehearsalPlanRead, RehearsalPlanRowDTO } from "../../types/rehearsalPlan.dto";
import type { PlanEditorData } from "./usePlanEditorData";

/** One row of the draft. `key` is the client's handle; `id` the server's, when saved. */
export interface PlanDraftRow {
  readonly key: string;
  readonly id: string | null;
  readonly piece: string | null;
  readonly label: string;
  readonly note: string;
  readonly starts_at: string | null;
  readonly excluded_voice_lines: readonly VoiceLine[];
  readonly excludes_instrumentalists: boolean;
  readonly done_at: string | null;
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
  readonly updateRow: (key: string, patch: Partial<Omit<PlanDraftRow, "key" | "id">>) => void;
  readonly toggleLine: (key: string, line: VoiceLine) => void;
  readonly toggleFamily: (key: string, family: VoiceFamilyId) => void;
  readonly removeRow: (key: string) => void;
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

const draftOf = (item: RehearsalPlanItem): PlanDraftRow => ({
  key: item.id,
  id: item.id,
  piece: item.piece,
  label: item.label,
  note: item.note,
  starts_at: item.starts_at,
  excluded_voice_lines: item.excluded_voice_lines,
  excludes_instrumentalists: item.excludes_instrumentalists,
  done_at: item.done_at,
});

/** A copied row: same content, no clock, no done stamp, no server identity. */
const copyOf = (item: RehearsalPlanItem): PlanDraftRow => ({
  key: makeKey(),
  id: null,
  piece: item.piece,
  label: item.label,
  note: item.note,
  starts_at: null,
  excluded_voice_lines: item.excluded_voice_lines,
  excludes_instrumentalists: item.excludes_instrumentalists,
  done_at: null,
});

const rowDTO = (row: PlanDraftRow): RehearsalPlanRowDTO => ({
  ...(row.id ? { id: row.id } : {}),
  piece: row.piece,
  label: row.piece ? "" : row.label.trim(),
  note: row.note.trim(),
  starts_at: row.starts_at || null,
  excluded_voice_lines: [...row.excluded_voice_lines],
  excludes_instrumentalists: row.excludes_instrumentalists,
});

/**
 * The order and content a save would send, without the server identities —
 * what "dirty" compares. Identity is left out on purpose: a save answers with
 * the same rows now carrying ids, and that answer must read as clean.
 */
const fingerprint = (rows: readonly PlanDraftRow[]): string =>
  JSON.stringify(
    rows.map((row) => {
      const { id: _id, ...content } = rowDTO(row);
      return content;
    }),
  );

const FAMILY_ORDER: readonly VoiceFamilyId[] = ["S", "MS", "A", "CT", "T", "BAR", "B", "V", "ROLE"];

export const usePlanEditor = (
  rehearsal: Rehearsal,
  serverPlan: RehearsalPlanRead | undefined,
  data: PlanEditorData,
): PlanEditor => {
  const serverRows = useMemo(() => serverPlan?.rows ?? [], [serverPlan]);
  const [rows, setRows] = useState<readonly PlanDraftRow[]>(() => serverRows.map(draftOf));
  const baseline = useRef(fingerprint(serverRows.map(draftOf)));
  const isDirty = fingerprint(rows) !== baseline.current;

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
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const baselined = useRef(false);
  useEffect(() => {
    const next = serverRows.map(draftOf);
    const nextFingerprint = fingerprint(next);
    const wasClean = fingerprint(rowsRef.current) === baseline.current;
    baseline.current = nextFingerprint;
    if (!baselined.current || wasClean || fingerprint(rowsRef.current) === nextFingerprint) {
      setRows(next);
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

  const carryOver = useMemo(() => {
    const previous = data.rehearsals
      .filter(
        (other) =>
          String(other.id) !== String(rehearsal.id) && other.date_time < rehearsal.date_time,
      )
      .sort((a, b) => b.date_time.localeCompare(a.date_time))[0];
    if (!previous) return null;
    const undone = (previous.plan ?? []).filter(
      (item) => item.done_at === null && (item.piece === null || programByPiece.has(item.piece)),
    );
    if (undone.length === 0) return null;
    const source = sources.find((candidate) => candidate.rehearsalId === String(previous.id));
    return source ? { source, undone: undone.length } : null;
  }, [data.rehearsals, rehearsal.id, rehearsal.date_time, programByPiece, sources]);

  /* ── Edits ───────────────────────────────────────────────────────────── */

  const addPieceRow = useCallback((pieceId: string) => {
    setRows((current) => [
      ...current,
      {
        key: makeKey(),
        id: null,
        piece: pieceId,
        label: "",
        note: "",
        starts_at: null,
        excluded_voice_lines: [],
        excludes_instrumentalists: false,
        done_at: null,
      },
    ]);
  }, []);

  const addFreeRow = useCallback(() => {
    setRows((current) => [
      ...current,
      {
        key: makeKey(),
        id: null,
        piece: null,
        label: "",
        note: "",
        starts_at: null,
        excluded_voice_lines: [],
        excludes_instrumentalists: false,
        done_at: null,
      },
    ]);
  }, []);

  const updateRow = useCallback<PlanEditor["updateRow"]>((key, patch) => {
    setRows((current) =>
      current.map((row) => {
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

  const toggleLine = useCallback((key: string, line: VoiceLine) => {
    setRows((current) =>
      current.map((row) => {
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
      setRows((current) =>
        current.map((row) => {
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
    setRows((current) => current.filter((row) => row.key !== key));
  }, []);

  const moveRow = useCallback((fromKey: string, toKey: string) => {
    setRows((current) => {
      const from = current.findIndex((row) => row.key === fromKey);
      const to = current.findIndex((row) => row.key === toKey);
      if (from === -1 || to === -1 || from === to) return current;
      return arrayMove([...current], from, to);
    });
  }, []);

  /* ── Fills ───────────────────────────────────────────────────────────── */

  const fillProgram = useCallback(() => {
    setRows((current) => {
      const present = new Set(current.map((row) => row.piece).filter(Boolean));
      const added = program
        .filter((item) => !present.has(String(item.piece)))
        .map<PlanDraftRow>((item) => ({
          key: makeKey(),
          id: null,
          piece: String(item.piece),
          label: "",
          note: "",
          starts_at: null,
          excluded_voice_lines: [],
          excludes_instrumentalists: false,
          done_at: null,
        }));
      return [...current, ...added];
    });
  }, [program]);

  const rowsOf = useCallback(
    (rehearsalId: string, onlyUndone: boolean): PlanDraftRow[] => {
      const source = data.rehearsals.find((other) => String(other.id) === rehearsalId);
      return (source?.plan ?? [])
        .filter((item) => !onlyUndone || item.done_at === null)
        // A piece since dropped from the programme cannot be planned — the
        // server would refuse the whole save for one stale row.
        .filter((item) => item.piece === null || programByPiece.has(item.piece))
        .map(copyOf);
    },
    [data.rehearsals, programByPiece],
  );

  const fillCarryOver = useCallback(() => {
    if (!carryOver) return;
    const copied = rowsOf(carryOver.source.rehearsalId, true);
    setRows((current) => [...current, ...copied]);
  }, [carryOver, rowsOf]);

  const copyFrom = useCallback(
    (rehearsalId: string) => {
      const copied = rowsOf(rehearsalId, false);
      setRows((current) => [...current, ...copied]);
    },
    [rowsOf],
  );

  const reset = useCallback(() => {
    setRows(serverRows.map(draftOf));
  }, [serverRows]);

  const toDTO = useCallback(() => rows.map(rowDTO), [rows]);

  return {
    rows,
    readings,
    calledTotal: seats.length,
    isDirty,
    programOptions,
    sources,
    carryOver,
    addPieceRow,
    addFreeRow,
    updateRow,
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
