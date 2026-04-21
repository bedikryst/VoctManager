/**
 * @file project.rehearsal.mutations.ts
 * @description React Query mutations for project rehearsal scheduling.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Rehearsal } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceOptimisticEntity,
  replaceEntityById,
} from "./project.query-utils";
import {
  buildOptimisticRehearsal,
  sortRehearsals,
} from "./project.optimistic";
import type {
  RehearsalCreateDTO,
  RehearsalUpdateDTO,
} from "../types/project.dto";

export const useCreateRehearsal = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RehearsalCreateDTO) =>
      ProjectService.createRehearsal(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("rehearsal");
      const queryKey = projectKeys.rehearsals.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousRehearsals = queryClient.getQueryData<Rehearsal[]>(queryKey);

      queryClient.setQueryData<Rehearsal[]>(
        queryKey,
        (currentRehearsals = []) =>
          sortRehearsals([
            ...currentRehearsals,
            buildOptimisticRehearsal(data, optimisticId),
          ]),
      );

      return { optimisticId, previousRehearsals };
    },
    onError: (_error, _variables, context) => {
      toast.error("Operation unsuccessful. Please verify your connection and try again.");
      if (context?.previousRehearsals) {
        queryClient.setQueryData(
          projectKeys.rehearsals.byProject(projectId),
          context.previousRehearsals,
        );
      }
    },
    onSuccess: (rehearsal, _variables, context) => {
      queryClient.setQueryData<Rehearsal[]>(
        projectKeys.rehearsals.byProject(projectId),
        (currentRehearsals) =>
          sortRehearsals(
            replaceOptimisticEntity(
              currentRehearsals,
              context?.optimisticId,
              rehearsal,
            ),
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.rehearsals.byProject(projectId),
      });
    },
  });
};

export const useUpdateRehearsal = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RehearsalUpdateDTO }) =>
      ProjectService.updateRehearsal(id, data),
    onMutate: async (variables) => {
      const queryKey = projectKeys.rehearsals.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousRehearsals = queryClient.getQueryData<Rehearsal[]>(queryKey);

      queryClient.setQueryData<Rehearsal[]>(
        queryKey,
        (currentRehearsals = []) =>
          sortRehearsals(
            currentRehearsals.map((rehearsal) =>
              String(rehearsal.id) === variables.id
                ? { ...rehearsal, ...variables.data }
                : rehearsal,
            ),
          ),
      );

      return { previousRehearsals };
    },
    onError: (_error, _variables, context) => {
      toast.error("Operation unsuccessful. Please verify your connection and try again.");
      if (context?.previousRehearsals) {
        queryClient.setQueryData(
          projectKeys.rehearsals.byProject(projectId),
          context.previousRehearsals,
        );
      }
    },
    onSuccess: (rehearsal, variables) => {
      queryClient.setQueryData<Rehearsal[]>(
        projectKeys.rehearsals.byProject(projectId),
        (currentRehearsals = []) =>
          sortRehearsals(
            replaceEntityById(currentRehearsals, variables.id, rehearsal) ??
              currentRehearsals,
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.rehearsals.byProject(projectId),
      });
    },
  });
};

export const useDeleteRehearsal = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteRehearsal(id),
    onMutate: async (id) => {
      const queryKey = projectKeys.rehearsals.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousRehearsals = queryClient.getQueryData<Rehearsal[]>(queryKey);

      queryClient.setQueryData<Rehearsal[]>(
        queryKey,
        (currentRehearsals = []) => removeEntityById(currentRehearsals, id) ?? [],
      );

      return { previousRehearsals };
    },
    onError: (_error, _variables, context) => {
      toast.error("Operation unsuccessful. Please verify your connection and try again.");
      if (context?.previousRehearsals) {
        queryClient.setQueryData(
          projectKeys.rehearsals.byProject(projectId),
          context.previousRehearsals,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.rehearsals.byProject(projectId),
      });
    },
  });
};
