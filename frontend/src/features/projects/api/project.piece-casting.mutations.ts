/**
 * @file project.piece-casting.mutations.ts
 * @description React Query mutations for project piece casting.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { PieceCasting } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceOptimisticEntity,
  replaceEntityById,
} from "./project.query-utils";
import { buildOptimisticPieceCasting } from "./project.optimistic";
import type {
  PieceCastingCreateDTO,
  PieceCastingUpdateDTO,
} from "../types/project.dto";

export const useCreatePieceCasting = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PieceCastingCreateDTO) =>
      ProjectService.createPieceCasting(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("pieceCasting");
      const queryKey = projectKeys.pieceCastings.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousPieceCastings =
        queryClient.getQueryData<PieceCasting[]>(queryKey);

      queryClient.setQueryData<PieceCasting[]>(
        queryKey,
        (currentPieceCastings = []) => [
          ...currentPieceCastings.filter(
            (casting) =>
              !(
                String(casting.participation) === data.participation &&
                String(casting.piece) === data.piece
              ),
          ),
          buildOptimisticPieceCasting(data, optimisticId),
        ],
      );

      return { optimisticId, previousPieceCastings };
    },
    onError: (_error, _variables, context) => {
      toast.error("Operation unsuccessful. Please verify your connection and try again.");
      if (context?.previousPieceCastings) {
        queryClient.setQueryData(
          projectKeys.pieceCastings.byProject(projectId),
          context.previousPieceCastings,
        );
      }
    },
    onSuccess: (pieceCasting, _variables, context) => {
      queryClient.setQueryData<PieceCasting[]>(
        projectKeys.pieceCastings.byProject(projectId),
        (currentPieceCastings) =>
          replaceOptimisticEntity(
            currentPieceCastings,
            context?.optimisticId,
            pieceCasting,
          ),
      );
    },
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
    },
  });
};

export const useUpdatePieceCasting = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PieceCastingUpdateDTO }) =>
      ProjectService.updatePieceCasting(id, data),
    onMutate: async (variables) => {
      const queryKey = projectKeys.pieceCastings.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousPieceCastings =
        queryClient.getQueryData<PieceCasting[]>(queryKey);

      queryClient.setQueryData<PieceCasting[]>(
        queryKey,
        (currentPieceCastings = []) =>
          currentPieceCastings.map((casting) =>
            String(casting.id) === variables.id
              ? { ...casting, ...variables.data }
              : casting,
          ),
      );

      return { previousPieceCastings };
    },
    onError: (_error, _variables, context) => {
      toast.error("Operation unsuccessful. Please verify your connection and try again.");
      if (context?.previousPieceCastings) {
        queryClient.setQueryData(
          projectKeys.pieceCastings.byProject(projectId),
          context.previousPieceCastings,
        );
      }
    },
    onSuccess: (pieceCasting, variables) => {
      queryClient.setQueryData<PieceCasting[]>(
        projectKeys.pieceCastings.byProject(projectId),
        (currentPieceCastings = []) =>
          replaceEntityById(currentPieceCastings, variables.id, pieceCasting) ??
          currentPieceCastings,
      );
    },
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
    },
  });
};

export const useDeletePieceCasting = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deletePieceCasting(id),
    onMutate: async (id) => {
      const queryKey = projectKeys.pieceCastings.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousPieceCastings =
        queryClient.getQueryData<PieceCasting[]>(queryKey);

      queryClient.setQueryData<PieceCasting[]>(
        queryKey,
        (currentPieceCastings = []) =>
          removeEntityById(currentPieceCastings, id) ?? [],
      );

      return { previousPieceCastings };
    },
    onError: (_error, _variables, context) => {
      toast.error("Operation unsuccessful. Please verify your connection and try again.");
      if (context?.previousPieceCastings) {
        queryClient.setQueryData(
          projectKeys.pieceCastings.byProject(projectId),
          context.previousPieceCastings,
        );
      }
    },
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
    },
  });
};
