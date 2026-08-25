/**
 * @file project.participation.mutations.ts
 * @description React Query mutations for project participation assignments.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastApiError } from "@/shared/api/errors";
import { invalidatePersonalReadModels } from "@/shared/api/queryPolicy";

import type { Participation } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceOptimisticEntity,
  replaceEntityById,
} from "./project.query-utils";
import { buildOptimisticParticipation } from "./project.optimistic";
import type {
  CastOrderDTO,
  ParticipationCreateDTO,
  ParticipationUpdateDTO,
  ProjectBulkFeeDTO,
} from "../types/project.dto";

/**
 * One standard rate across the whole cast. No optimistic write: the server
 * decides which rows it may touch (settled fees and declines are excluded), so
 * guessing the result here would show a repricing that did not happen.
 */
export const useApplyBulkCastFee = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fee: number) =>
      ProjectService.applyBulkCastFee({
        project_id: projectId,
        fee,
      } satisfies ProjectBulkFeeDTO),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    },
  });
};

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
    onError: (error, _variables, context) => {
      toastApiError(error);
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
        (currentParticipations) =>
          replaceOptimisticEntity(
            currentParticipations,
            context?.optimisticId,
            participation,
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      // Participation = ensemble membership, which drives both the chorister's
      // Materials program and their personal Schedule. Reconcile those personal
      // read-models (cross-session propagation rides their focus-refetch).
      invalidatePersonalReadModels(queryClient);
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
    onError: (error, _variables, context) => {
      toastApiError(error);
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
      // Participation = ensemble membership, which drives both the chorister's
      // Materials program and their personal Schedule. Reconcile those personal
      // read-models (cross-session propagation rides their focus-refetch).
      invalidatePersonalReadModels(queryClient);
    },
  });
};

/**
 * One voice section, in the order the conductor just dragged it into.
 *
 * Optimistic on purpose: the list the user is looking at IS the order they just
 * built, so waiting for the round-trip would make every drag snap back to the
 * old order for as long as the network takes. The rollback restores the whole
 * section, not the one row that moved — a rank is only meaningful next to its
 * neighbours.
 */
export const useSaveCastOrder = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CastOrderDTO) => ProjectService.saveCastOrder(data),
    onMutate: async (data) => {
      const queryKey = projectKeys.participations.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousParticipations =
        queryClient.getQueryData<Participation[]>(queryKey);

      const rankById = new Map(
        data.order.map((row) => [row.participation, row.section_rank]),
      );

      queryClient.setQueryData<Participation[]>(
        queryKey,
        (currentParticipations = []) =>
          currentParticipations.map((participation) => {
            const rank = rankById.get(String(participation.id));
            return rank === undefined
              ? participation
              : { ...participation, section_rank: rank };
          }),
      );

      return { previousParticipations };
    },
    onError: (error, _variables, context) => {
      toastApiError(error);
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
      // The arrangement is what the songbook and the divisi list read the cast
      // in, so a manager who also sings in this project must not keep seeing the
      // order they just replaced.
      invalidatePersonalReadModels(queryClient);
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
    onError: (error, _variables, context) => {
      toastApiError(error);
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
      // Participation = ensemble membership, which drives both the chorister's
      // Materials program and their personal Schedule. Reconcile those personal
      // read-models (cross-session propagation rides their focus-refetch).
      invalidatePersonalReadModels(queryClient);
    },
  });
};
