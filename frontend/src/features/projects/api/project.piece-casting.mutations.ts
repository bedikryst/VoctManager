/**
 * @file project.piece-casting.mutations.ts
 * @description React Query mutation for the divisi board.
 * Casting is saved as a whole board per piece, not casting by casting: the editor
 * holds an in-memory draft and commits once, so there is nothing to update
 * optimistically — the server's answer is the new baseline.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastApiError } from "@/shared/api/errors";
import { invalidatePersonalReadModels } from "@/shared/api/queryPolicy";

import type { PieceCasting } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import type { PieceCastingBoardDTO } from "../types/project.dto";

export const useSavePieceCastingBoard = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PieceCastingBoardDTO) =>
      ProjectService.savePieceCastingBoard(data),
    onSuccess: (board, variables) => {
      // The response is the persisted board for one piece, so it replaces that
      // slice of the project-wide list rather than merging into it.
      queryClient.setQueryData<PieceCasting[]>(
        projectKeys.pieceCastings.byProject(projectId),
        (currentPieceCastings = []) => [
          ...currentPieceCastings.filter(
            (casting) => String(casting.piece) !== variables.piece,
          ),
          ...board,
        ],
      );
    },
    onError: (error) => toastApiError(error),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.pieceCastings.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.pieceCastings.all,
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      // Casting decides which pieces a chorister sees in their Materials
      // program — reconcile their personal read-models (no-op across sessions,
      // where the dashboards' own focus-refetch carries the change).
      invalidatePersonalReadModels(queryClient);
    },
  });
};
