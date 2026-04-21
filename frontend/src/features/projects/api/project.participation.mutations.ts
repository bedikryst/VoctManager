/**
 * @file project.participation.mutations.ts
 * @description React Query mutations for project participation assignments.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Participation } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceEntityById,
} from "./project.query-utils";
import { buildOptimisticParticipation } from "./project.optimistic";
import type {
  ParticipationCreateDTO,
  ParticipationUpdateDTO,
} from "../types/project.dto";

export const useCreateParticipation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ParticipationCreateDTO) =>
      ProjectService.createParticipation(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("participation");
      const queryKey = projectKeys.participations.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousParticipations =
        queryClient.getQueryData<Participation[]>(queryKey);

      queryClient.setQueryData<Participation[]>(
        queryKey,
        (currentParticipations = []) => [
          ...currentParticipations,
          buildOptimisticParticipation(data, optimisticId),
        ],
      );

      return { optimisticId, previousParticipations };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousParticipations) {
        queryClient.setQueryData(
          projectKeys.participations.byProject(projectId),
          context.previousParticipations,
        );
      }
    },
    onSuccess: (participation, _variables, context) => {
      queryClient.setQueryData<Participation[]>(
        projectKeys.participations.byProject(projectId),
        (currentParticipations = []) =>
          replaceEntityById(
            currentParticipations,
            context?.optimisticId ?? "",
            participation,
          ) ?? [...currentParticipations, participation],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    },
  });
};

export const useUpdateParticipation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ParticipationUpdateDTO }) =>
      ProjectService.updateParticipation(id, data),
    onMutate: async (variables) => {
      const queryKey = projectKeys.participations.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousParticipations =
        queryClient.getQueryData<Participation[]>(queryKey);

      queryClient.setQueryData<Participation[]>(
        queryKey,
        (currentParticipations = []) =>
          currentParticipations.map((participation) =>
            String(participation.id) === variables.id
              ? { ...participation, ...variables.data }
              : participation,
          ),
      );

      return { previousParticipations };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousParticipations) {
        queryClient.setQueryData(
          projectKeys.participations.byProject(projectId),
          context.previousParticipations,
        );
      }
    },
    onSuccess: (participation, variables) => {
      queryClient.setQueryData<Participation[]>(
        projectKeys.participations.byProject(projectId),
        (currentParticipations = []) =>
          replaceEntityById(currentParticipations, variables.id, participation) ??
          currentParticipations,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    },
  });
};

export const useDeleteParticipation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteParticipation(id),
    onMutate: async (id) => {
      const queryKey = projectKeys.participations.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousParticipations =
        queryClient.getQueryData<Participation[]>(queryKey);

      queryClient.setQueryData<Participation[]>(
        queryKey,
        (currentParticipations = []) =>
          removeEntityById(currentParticipations, id) ?? [],
      );

      return { previousParticipations };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousParticipations) {
        queryClient.setQueryData(
          projectKeys.participations.byProject(projectId),
          context.previousParticipations,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    },
  });
};
