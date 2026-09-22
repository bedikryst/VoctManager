/**
 * @file useProjectPlanGrid.ts
 * @description The model behind the project grid — pieces × rehearsals. Rows
 * are the programme's pieces in programme order, one per piece: a plan row
 * names a piece, not a programme slot, so a piece the programme lists twice is
 * still one row. Columns are the project's rehearsals by date. A cell is what
 * that evening's plan says of the piece, read off the plan rows and their
 * `done` — never the verdict stamps, which a missed debrief leaves empty.
 * Breaks and free rows are not pieces and never reach a cell.
 *
 * A tap on an evening that has not started writes that plan whole through
 * `PUT plan/`, built from the freshest rows known for it. Taps on one evening
 * run one after another, each on the rows the previous one left, so two quick
 * taps never send two lists built from the same read. A piece goes in above
 * the reserve divider with no clock, and comes out only while it sits on the
 * evening once; a second copy is the editor's to sort out. An editor draft of
 * the same evening wins on its next save — the editor is a modal sheet, so the
 * two are never open side by side.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/useProjectPlanGrid
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectProgram } from "@/features/projects/api/project.queries";
import { toastApiError } from "@/shared/api/errors";
import type { Rehearsal, RehearsalPlanItem } from "@/shared/types";
import { useSaveAnyRehearsalPlan } from "../../api/plan.queries";
import { rehearsalKeys } from "../../api/rehearsals.queries";
import { RehearsalsService } from "../../api/rehearsals.service";
import type { RehearsalPlanRead, RehearsalPlanRowDTO } from "../../types/rehearsalPlan.dto";

/** What an evening's plan says of one piece. */
export type PlanCellState = "planned" | "reserve" | "done" | "not_done";

export interface PlanGridCell {
  /** Null = the piece is not on that evening's plan. */
  readonly state: PlanCellState | null;
  /** Rows of the piece on that evening; two or more read "×2". */
  readonly count: number;
  /**
   * The piece's one row carries something the conductor typed beyond the
   * piece — a note, minutes, an anchor, an exclusion — which removing it loses.
   */
  readonly carriesContent: boolean;
  /** A tap is on its way to the server; `state` already shows what it asked for. */
  readonly isPending: boolean;
}

export interface PlanGridColumn {
  readonly rehearsal: Rehearsal;
  /** The evening has started: its plan is the record, and the column only reads. */
  readonly isLocked: boolean;
  /**
   * Whether the choir has what the column shows: "draft" = never sent,
   * "unsent" = changed since the last send, null = sent as it stands, nothing
   * to send, or the evening has started (the plan is public by then).
   */
  readonly sendState: "draft" | "unsent" | null;
}

export interface PlanGridRow {
  readonly pieceId: string;
  readonly title: string;
  /** Distinct evenings the piece was done on; null until the project has a verdict. */
  readonly rehearsedCount: number | null;
  readonly lastRehearsedOn: string | null;
}

export interface ProjectPlanGrid {
  readonly rows: readonly PlanGridRow[];
  readonly columns: readonly PlanGridColumn[];
  /** The programme's figures mean something: some row of the project has a verdict. */
  readonly showStatistics: boolean;
  readonly cellOf: (rehearsalId: string, pieceId: string) => PlanGridCell;
  /** Puts the piece on the evening's plan, or takes its one row off it. */
  readonly setInPlan: (rehearsalId: string, pieceId: string, inPlan: boolean) => void;
}

/** An evening's plan as the server last answered it. */
interface KnownPlan {
  readonly rows: readonly RehearsalPlanItem[];
  readonly changedAt: string | null;
  readonly announcedAt: string | null;
}

const EMPTY_CELL: PlanGridCell = {
  state: null,
  count: 0,
  carriesContent: false,
  isPending: false,
};

const cellKey = (rehearsalId: string, pieceId: string): string => `${rehearsalId}:${pieceId}`;

const stampOf = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : 0);

/**
 * The list payload, unless a save has answered since the list was read — the
 * plan query then holds the newer answer. `plan_changed_at` decides; the list
 * wins a tie. Null when neither carries the plan: a write built on nothing
 * would send an empty list and clear the evening.
 */
const knownPlanOf = (
  listed: Rehearsal | undefined,
  saved: RehearsalPlanRead | undefined,
): KnownPlan | null => {
  if (saved && stampOf(saved.plan_changed_at) > stampOf(listed?.plan_changed_at)) {
    return {
      rows: saved.rows,
      changedAt: saved.plan_changed_at,
      announcedAt: saved.plan_announced_at,
    };
  }
  if (!listed?.plan) return null;
  return {
    rows: listed.plan,
    changedAt: listed.plan_changed_at ?? null,
    announcedAt: listed.plan_announced_at ?? null,
  };
};

const pieceRowsOf = (
  rows: readonly RehearsalPlanItem[],
  pieceId: string,
): RehearsalPlanItem[] =>
  rows.filter((row) => !row.is_break && row.piece !== null && String(row.piece) === pieceId);

/** A stored row sent back as it stands; its `id` keeps its verdict. */
const itemDTO = (item: RehearsalPlanItem): RehearsalPlanRowDTO => ({
  id: item.id,
  piece: item.piece,
  label: item.label,
  note: item.note,
  starts_at: item.starts_at,
  minutes: item.minutes,
  excluded_voice_lines: [...item.excluded_voice_lines],
  excludes_instrumentalists: item.excludes_instrumentalists,
  is_reserve: item.is_reserve,
  is_break: item.is_break,
});

const carriesContent = (item: RehearsalPlanItem): boolean =>
  item.note.trim() !== "" ||
  item.minutes !== null ||
  item.starts_at !== null ||
  item.excluded_voice_lines.length > 0 ||
  item.excludes_instrumentalists;

/**
 * Several rows of one piece on one evening read as the evening's strongest
 * claim on it: done, then not done, then planned over reserve.
 */
const stateOf = (rows: readonly RehearsalPlanItem[]): PlanCellState => {
  if (rows.some((row) => row.done === true)) return "done";
  if (rows.some((row) => row.done === false)) return "not_done";
  return rows.some((row) => !row.is_reserve) ? "planned" : "reserve";
};

/** The list with the piece added above the reserve divider; null when it is there already. */
const withPiece = (
  rows: readonly RehearsalPlanItem[],
  pieceId: string,
): RehearsalPlanRowDTO[] | null => {
  if (pieceRowsOf(rows, pieceId).length > 0) return null;
  const sent = rows.map(itemDTO);
  const firstReserve = rows.findIndex((row) => row.is_reserve);
  sent.splice(firstReserve === -1 ? sent.length : firstReserve, 0, {
    piece: pieceId,
    label: "",
    note: "",
    starts_at: null,
    minutes: null,
    excluded_voice_lines: [],
    excludes_instrumentalists: false,
    is_reserve: false,
    is_break: false,
  });
  return sent;
};

/** The list without the piece's one row; null unless it sits there exactly once. */
const withoutPiece = (
  rows: readonly RehearsalPlanItem[],
  pieceId: string,
): RehearsalPlanRowDTO[] | null => {
  const [only, ...more] = pieceRowsOf(rows, pieceId);
  if (!only || more.length > 0) return null;
  return rows.filter((row) => row.id !== only.id).map(itemDTO);
};

export const useProjectPlanGrid = (
  projectId: string,
  rehearsals: readonly Rehearsal[],
): ProjectPlanGrid => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: program } = useProjectProgram(projectId);
  const { mutateAsync: savePlan } = useSaveAnyRehearsalPlan();

  // Observed, never fetched: a save answers into these keys before the list
  // has re-read, and the cells follow the answer the moment it lands.
  const savedPlans = useQueries({
    queries: rehearsals.map((rehearsal) => ({
      queryKey: rehearsalKeys.rehearsals.plan(String(rehearsal.id)),
      queryFn: () => RehearsalsService.getPlan(String(rehearsal.id)),
      enabled: false,
    })),
  });

  const rows = useMemo<PlanGridRow[]>(() => {
    const seen = new Set<string>();
    const result: PlanGridRow[] = [];
    for (const item of [...program].sort((a, b) => a.order - b.order)) {
      const pieceId = String(item.piece);
      if (seen.has(pieceId)) continue;
      seen.add(pieceId);
      result.push({
        pieceId,
        title: item.piece_title ?? "",
        rehearsedCount: item.rehearsed_count ?? null,
        lastRehearsedOn: item.last_rehearsed_on ?? null,
      });
    }
    return result;
  }, [program]);

  const knownPlans = useMemo(
    () =>
      rehearsals.map((rehearsal, index) =>
        knownPlanOf(rehearsal, savedPlans[index]?.data),
      ),
    [rehearsals, savedPlans],
  );

  const columns = useMemo<PlanGridColumn[]>(() => {
    const now = Date.now();
    return rehearsals.map((rehearsal, index) => {
      const known = knownPlans[index] ?? null;
      const isLocked = Date.parse(rehearsal.date_time) <= now;
      let sendState: PlanGridColumn["sendState"] = null;
      if (!isLocked && known) {
        if (known.announcedAt === null) {
          sendState = known.rows.length > 0 ? "draft" : null;
        } else if (stampOf(known.changedAt) > stampOf(known.announcedAt)) {
          sendState = "unsent";
        }
      }
      return { rehearsal, isLocked, sendState };
    });
  }, [rehearsals, knownPlans]);

  const cells = useMemo(() => {
    const map = new Map<string, PlanGridCell>();
    rehearsals.forEach((rehearsal, index) => {
      const byPiece = new Map<string, RehearsalPlanItem[]>();
      for (const row of knownPlans[index]?.rows ?? []) {
        if (row.is_break || row.piece === null) continue;
        const pieceId = String(row.piece);
        byPiece.set(pieceId, [...(byPiece.get(pieceId) ?? []), row]);
      }
      for (const [pieceId, pieceRows] of byPiece) {
        const [only, ...more] = pieceRows;
        map.set(cellKey(String(rehearsal.id), pieceId), {
          state: stateOf(pieceRows),
          count: pieceRows.length,
          carriesContent: only !== undefined && more.length === 0 && carriesContent(only),
          isPending: false,
        });
      }
    });
    return map;
  }, [rehearsals, knownPlans]);

  // What each waiting tap asked for, by cell. A token per cell lets a later
  // tap on the same cell own the overlay: an earlier write settling must not
  // clear what the conductor asked for after it.
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const tokens = useRef(new Map<string, number>());
  const queues = useRef(new Map<string, Promise<void>>());
  const rehearsalsRef = useRef(rehearsals);
  rehearsalsRef.current = rehearsals;

  const cellOf = useCallback(
    (rehearsalId: string, pieceId: string): PlanGridCell => {
      const key = cellKey(rehearsalId, pieceId);
      const stored = cells.get(key) ?? EMPTY_CELL;
      const wanted = pending.get(key);
      if (wanted === undefined) return stored;
      if (!wanted) return { ...EMPTY_CELL, isPending: true };
      return stored.state === null
        ? { ...EMPTY_CELL, state: "planned", count: 1, isPending: true }
        : { ...stored, isPending: true };
    },
    [cells, pending],
  );

  const setInPlan = useCallback(
    (rehearsalId: string, pieceId: string, inPlan: boolean): void => {
      const key = cellKey(rehearsalId, pieceId);
      const token = (tokens.current.get(key) ?? 0) + 1;
      tokens.current.set(key, token);
      setPending((current) => new Map(current).set(key, inPlan));

      // Read when the write's turn comes, not at the tap: by then the write
      // queued before it has answered into the plan query.
      const write = async (): Promise<void> => {
        const known = knownPlanOf(
          rehearsalsRef.current.find((rehearsal) => String(rehearsal.id) === rehearsalId),
          queryClient.getQueryData<RehearsalPlanRead>(rehearsalKeys.rehearsals.plan(rehearsalId)),
        );
        const fallbackDescription = t(
          "rehearsals.plan.toast.save_error",
          "Nie udało się zapisać planu.",
        );
        if (known === null) {
          toast.error(fallbackDescription);
          return;
        }
        const next = inPlan ? withPiece(known.rows, pieceId) : withoutPiece(known.rows, pieceId);
        if (next === null) return;
        try {
          await savePlan({ rehearsalId, data: { rows: next } });
        } catch (error) {
          toastApiError(error, t, { fallbackDescription });
        }
      };

      const settle = (): void => {
        if (tokens.current.get(key) !== token) return;
        setPending((current) => {
          const next = new Map(current);
          next.delete(key);
          return next;
        });
      };

      const queued = (queues.current.get(rehearsalId) ?? Promise.resolve())
        .then(write)
        .then(settle);
      queues.current.set(rehearsalId, queued);
    },
    [queryClient, savePlan, t],
  );

  const showStatistics = rows.some((row) => row.rehearsedCount !== null);

  return { rows, columns, showStatistics, cellOf, setInPlan };
};
