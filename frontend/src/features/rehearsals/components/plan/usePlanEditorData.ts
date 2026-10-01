/**
 * @file usePlanEditorData.ts
 * @description What the plan editor needs of the project beyond the plan
 * itself: the programme (the rows a piece can be), the casting board and the
 * cast (so every exclusion chip can say how many people it removes), the piece
 * dictionary (which lines a piece declares), and the project's other
 * rehearsals (the plans a fill can carry over from), and the attendance
 * register (who has reported they are not coming).
 *
 * Two doors to the same data, chosen by who is reading. A manager reads it
 * under the same keys as the project hub's and the roll call's own queries, so
 * they share one cache. A planner who is not a manager (the assistant
 * conductor announced for the evening, the project's conductor) has none of
 * those lists: they read one projection through the evening they may plan
 * (`plan/editor/`), whose fields are exactly the editor's inputs. Both without
 * suspense: the editor is a band inside a card that is already on screen, and
 * it gates itself on `isLoading` and `isLoadError` rather than unmounting its
 * host — a read that never answered must not pass for a project with no
 * programme. The register is not part of that gate: the rows do not wait for a
 * strip that reads it.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/usePlanEditorData
 */

import { useQuery } from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import { ProjectService } from "@/features/projects/api/project.service";
import { projectKeys } from "@/features/projects/api/project.query-keys";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
  STATIC_DICTIONARY_STALE_TIME,
} from "@/features/projects/api/project.query-utils";
import type { Attendance, Participation, Rehearsal } from "@/shared/types";
import { useAttendanceRegister } from "../../api/rehearsals.queries";
import { usePlanEditorRead } from "../../api/plan.queries";
import type {
  PlanEditorCasting,
  PlanEditorPiece,
  PlanEditorProgramItem,
  PlanEditorRehearsal,
  PlanEditorSeat,
} from "../../types/rehearsalPlan.dto";

/**
 * Whose door the editor reads the project through. `manager` — the hub's
 * lists; `planner` — the evening's own projection, for a reader the server
 * lets plan this evening without making them a manager.
 */
export type PlanEditorAccess = "manager" | "planner";

export interface PlanEditorData {
  readonly program: PlanEditorProgramItem[];
  readonly castings: PlanEditorCasting[];
  /** Everyone still in play on the project — declined seats pruned. */
  readonly participations: PlanEditorSeat[];
  readonly pieces: PlanEditorPiece[];
  readonly rehearsals: PlanEditorRehearsal[];
  /** The flat register, every rehearsal's rows; undefined until it answers. */
  readonly attendances: Attendance[] | undefined;
  readonly isLoading: boolean;
  /** A read failed before it ever answered: the lists above are empty for that, not for the project. */
  readonly isLoadError: boolean;
  /** Re-asks every read that failed so. */
  readonly retry: () => void;
}

const EMPTY_PROGRAM: PlanEditorProgramItem[] = [];
const EMPTY_CASTINGS: PlanEditorCasting[] = [];
const EMPTY_PARTICIPATIONS: PlanEditorSeat[] = [];
const EMPTY_PIECES: PlanEditorPiece[] = [];
const EMPTY_REHEARSALS: PlanEditorRehearsal[] = [];

const selectInPlay = (rows: Participation[]): Participation[] =>
  rows.filter((row) => row.status !== "DEC");

export const usePlanEditorData = (
  rehearsal: Pick<Rehearsal, "id" | "project">,
  access: PlanEditorAccess,
): PlanEditorData => {
  const projectId = String(rehearsal.project);
  const asManager = access === "manager";

  const program = useQuery({
    queryKey: projectKeys.program.byProject(projectId),
    queryFn: () => ProjectService.getProgramByProject(projectId),
    enabled: asManager,
    ...RECONCILING_REFETCH,
    staleTime: FAST_CHANGING_STALE_TIME,
  });
  const castings = useQuery({
    queryKey: projectKeys.pieceCastings.byProject(projectId),
    queryFn: () => ProjectService.getPieceCastingsByProject(projectId),
    enabled: asManager,
    ...RECONCILING_REFETCH,
    staleTime: FAST_CHANGING_STALE_TIME,
  });
  const participations = useQuery({
    queryKey: projectKeys.participations.byProject(projectId),
    queryFn: () => ProjectService.getParticipationsByProject(projectId),
    enabled: asManager,
    ...RECONCILING_REFETCH,
    staleTime: PROJECT_RELATION_STALE_TIME,
    select: selectInPlay,
  });
  const pieces = useQuery({
    queryKey: projectKeys.dictionaries.pieces,
    queryFn: ProjectService.getPiecesDictionary,
    enabled: asManager,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
  });
  const rehearsals = useQuery({
    queryKey: projectKeys.rehearsals.byProject(projectId),
    queryFn: () => ProjectService.getRehearsalsByProject(projectId),
    enabled: asManager,
    ...RECONCILING_REFETCH,
    staleTime: PROJECT_RELATION_STALE_TIME,
  });
  const planned = usePlanEditorRead(String(rehearsal.id), !asManager);
  const attendances = useAttendanceRegister();

  const reads = asManager ? [program, castings, participations, pieces, rehearsals] : [planned];
  const retry = (): void => {
    for (const read of reads) if (read.isLoadingError) void read.refetch();
  };
  const isLoading = reads.some((read) => read.isLoading);
  const isLoadError = reads.some((read) => read.isLoadingError);

  if (!asManager) {
    return {
      program: planned.data?.program ?? EMPTY_PROGRAM,
      castings: planned.data?.castings ?? EMPTY_CASTINGS,
      participations: planned.data?.participations ?? EMPTY_PARTICIPATIONS,
      pieces: planned.data?.pieces ?? EMPTY_PIECES,
      rehearsals: planned.data?.rehearsals ?? EMPTY_REHEARSALS,
      attendances: attendances.data,
      isLoading,
      isLoadError,
      retry,
    };
  }

  return {
    program: program.data ?? EMPTY_PROGRAM,
    castings: castings.data ?? EMPTY_CASTINGS,
    participations: participations.data ?? EMPTY_PARTICIPATIONS,
    pieces: pieces.data ?? EMPTY_PIECES,
    rehearsals: rehearsals.data ?? EMPTY_REHEARSALS,
    attendances: attendances.data,
    isLoading,
    isLoadError,
    retry,
  };
};
