/**
 * @file usePlanEditorData.ts
 * @description What the plan editor needs of the project beyond the plan
 * itself: the programme (the rows a piece can be), the casting board and the
 * cast (so every exclusion chip can say how many people it removes), the piece
 * dictionary (which lines a piece declares), and the project's other
 * rehearsals (the plans a fill can carry over from), and the attendance
 * register (who has reported they are not coming). Read under the same keys
 * as the project hub's and the roll call's own queries so they share one
 * cache — but without suspense: the editor is a band inside a card that is
 * already on screen, and it gates itself on `isLoading` rather than
 * unmounting its host. The register is not part of that gate: the rows do not
 * wait for a strip that reads it.
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
import type {
  Attendance,
  Participation,
  Piece,
  PieceCasting,
  ProgramItem,
  Rehearsal,
} from "@/shared/types";
import { useAttendanceRegister } from "../../api/rehearsals.queries";

export interface PlanEditorData {
  readonly program: ProgramItem[];
  readonly castings: PieceCasting[];
  /** Everyone still in play on the project — declined seats pruned. */
  readonly participations: Participation[];
  readonly pieces: Piece[];
  readonly rehearsals: Rehearsal[];
  /** The flat register, every rehearsal's rows; undefined until it answers. */
  readonly attendances: Attendance[] | undefined;
  readonly isLoading: boolean;
}

const EMPTY_PROGRAM: ProgramItem[] = [];
const EMPTY_CASTINGS: PieceCasting[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];
const EMPTY_PIECES: Piece[] = [];
const EMPTY_REHEARSALS: Rehearsal[] = [];

const selectInPlay = (rows: Participation[]): Participation[] =>
  rows.filter((row) => row.status !== "DEC");

export const usePlanEditorData = (projectId: string): PlanEditorData => {
  const program = useQuery({
    queryKey: projectKeys.program.byProject(projectId),
    queryFn: () => ProjectService.getProgramByProject(projectId),
    ...RECONCILING_REFETCH,
    staleTime: FAST_CHANGING_STALE_TIME,
  });
  const castings = useQuery({
    queryKey: projectKeys.pieceCastings.byProject(projectId),
    queryFn: () => ProjectService.getPieceCastingsByProject(projectId),
    ...RECONCILING_REFETCH,
    staleTime: FAST_CHANGING_STALE_TIME,
  });
  const participations = useQuery({
    queryKey: projectKeys.participations.byProject(projectId),
    queryFn: () => ProjectService.getParticipationsByProject(projectId),
    ...RECONCILING_REFETCH,
    staleTime: PROJECT_RELATION_STALE_TIME,
    select: selectInPlay,
  });
  const pieces = useQuery({
    queryKey: projectKeys.dictionaries.pieces,
    queryFn: ProjectService.getPiecesDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
  });
  const rehearsals = useQuery({
    queryKey: projectKeys.rehearsals.byProject(projectId),
    queryFn: () => ProjectService.getRehearsalsByProject(projectId),
    ...RECONCILING_REFETCH,
    staleTime: PROJECT_RELATION_STALE_TIME,
  });
  const attendances = useAttendanceRegister();

  return {
    program: program.data ?? EMPTY_PROGRAM,
    castings: castings.data ?? EMPTY_CASTINGS,
    participations: participations.data ?? EMPTY_PARTICIPATIONS,
    pieces: pieces.data ?? EMPTY_PIECES,
    rehearsals: rehearsals.data ?? EMPTY_REHEARSALS,
    attendances: attendances.data,
    isLoading:
      program.isLoading ||
      castings.isLoading ||
      participations.isLoading ||
      pieces.isLoading ||
      rehearsals.isLoading,
  };
};
