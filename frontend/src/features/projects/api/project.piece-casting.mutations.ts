/**
 * @file project.piece-casting.mutations.ts
 * @description React Query mutations for the divisi board.
 * Casting is saved as a whole board per piece, not casting by casting: the editor
 * holds an in-memory draft and commits once, so there is nothing to update
 * optimistically — the server's answer is the new baseline. Filling the whole
 * programme from the line-up sends the same shape, many boards at a time.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toastApiError } from "@/shared/api/errors";
import { invalidatePersonalReadModels } from "@/shared/api/queryPolicy";

import type { PieceCasting } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import type {
  PieceCastingBoardDTO,
  PieceCastingBoardsDTO,
} from "../types/project.dto";

/** What a written board makes stale, wherever the write came from. */
const invalidateAfterBoardWrite = (
  queryClient: QueryClient,
  projectId: string,
): void => {
  queryClient.invalidateQueries({
    queryKey: projectKeys.pieceCastings.byProject(projectId),
  });
  queryClient.invalidateQueries({ queryKey: projectKeys.pieceCastings.all });
  queryClient.invalidateQueries({
    queryKey: projectKeys.program.byProject(projectId),
  });
  queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
  // Casting decides which pieces a chorister sees in their Materials program —
  // reconcile their personal read-models (no-op across sessions, where the
  // dashboards' own focus-refetch carries the change).
  invalidatePersonalReadModels(queryClient);
};

/** Replaces the cached seats of the pieces a response speaks for. */
const replaceBoards = (
  queryClient: QueryClient,
  projectId: string,
  pieceIds: ReadonlySet<string>,
  saved: PieceCasting[],
): void => {
  queryClient.setQueryData<PieceCasting[]>(
    projectKeys.pieceCastings.byProject(projectId),
    (currentPieceCastings = []) => [
      ...currentPieceCastings.filter(
        (casting) => !pieceIds.has(String(casting.piece)),
      ),
      ...saved,
    ],
  );
};

export const useSavePieceCastingBoard = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PieceCastingBoardDTO) =>
      ProjectService.savePieceCastingBoard(data),
    onSuccess: (board, variables) => {
      // The response is the persisted board for one piece, so it replaces that
      // slice of the project-wide list rather than merging into it.
      replaceBoards(queryClient, projectId, new Set([variables.piece]), board);
    },
    onError: (error) => toastApiError(error),
    onSettled: () => invalidateAfterBoardWrite(queryClient, projectId),
  });
};

export const useSavePieceCastingBoards = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PieceCastingBoardsDTO) =>
      ProjectService.savePieceCastingBoards(data),
    onSuccess: (saved, variables) => {
      replaceBoards(
        queryClient,
        projectId,
        new Set(variables.boards.map((board) => board.piece)),
        saved,
      );
    },
    onError: (error) => toastApiError(error),
    onSettled: () => invalidateAfterBoardWrite(queryClient, projectId),
  });
};
