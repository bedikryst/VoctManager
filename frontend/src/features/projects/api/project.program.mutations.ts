/**
 * @file project.program.mutations.ts
 * @description React Query mutations for project program items.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ProgramItem } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceEntityById,
} from "./project.query-utils";
import {
  buildOptimisticProgramItem,
  sortProgramItems,
} from "./project.optimistic";
import type {
  ProgramItemCreateDTO,
  ProgramItemUpdateDTO,
} from "../types/project.dto";

export const useCreateProgramItem = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProgramItemCreateDTO) =>
      ProjectService.createProgramItem(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("programItem");
      const queryKey = projectKeys.program.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousProgramItems =
        queryClient.getQueryData<ProgramItem[]>(queryKey);

      queryClient.setQueryData<ProgramItem[]>(
        queryKey,
        (currentProgramItems = []) =>
          sortProgramItems([
            ...currentProgramItems,
            buildOptimisticProgramItem(data, optimisticId),
          ]),
      );

      return { optimisticId, previousProgramItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProgramItems) {
        queryClient.setQueryData(
          projectKeys.program.byProject(projectId),
          context.previousProgramItems,
        );
      }
    },
    onSuccess: (programItem, _variables, context) => {
      queryClient.setQueryData<ProgramItem[]>(
        projectKeys.program.byProject(projectId),
        (currentProgramItems = []) =>
          sortProgramItems(
            replaceEntityById(
              currentProgramItems,
              context?.optimisticId ?? "",
              programItem,
            ) ?? [...currentProgramItems, programItem],
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.program.all });
    },
  });
};

export const useUpdateProgramItem = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProgramItemUpdateDTO }) =>
      ProjectService.updateProgramItem(id, data),
    onMutate: async (variables) => {
      const queryKey = projectKeys.program.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousProgramItems =
        queryClient.getQueryData<ProgramItem[]>(queryKey);

      queryClient.setQueryData<ProgramItem[]>(
        queryKey,
        (currentProgramItems = []) =>
          sortProgramItems(
            currentProgramItems.map((programItem) =>
              String(programItem.id) === variables.id
                ? { ...programItem, ...variables.data }
                : programItem,
            ),
          ),
      );

      return { previousProgramItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProgramItems) {
        queryClient.setQueryData(
          projectKeys.program.byProject(projectId),
          context.previousProgramItems,
        );
      }
    },
    onSuccess: (programItem, variables) => {
      queryClient.setQueryData<ProgramItem[]>(
        projectKeys.program.byProject(projectId),
        (currentProgramItems = []) =>
          sortProgramItems(
            replaceEntityById(currentProgramItems, variables.id, programItem) ??
              currentProgramItems,
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.program.all });
    },
  });
};

export const useDeleteProgramItem = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteProgramItem(id),
    onMutate: async (id) => {
      const queryKey = projectKeys.program.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousProgramItems =
        queryClient.getQueryData<ProgramItem[]>(queryKey);

      queryClient.setQueryData<ProgramItem[]>(
        queryKey,
        (currentProgramItems = []) =>
          removeEntityById(currentProgramItems, id) ?? [],
      );

      return { previousProgramItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProgramItems) {
        queryClient.setQueryData(
          projectKeys.program.byProject(projectId),
          context.previousProgramItems,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.program.all });
    },
  });
};
