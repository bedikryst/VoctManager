/**
 * @file project.crew.mutations.ts
 * @description React Query mutations for project crew assignments. A crew
 * booking is a row of the project's fee ledger, so every write marks the
 * project's budget stale, and a removal the ledger refuses (a paid or
 * contracted fee) says so in the finance module's words.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { financeErrorCopy } from "@/features/finance/lib/financeErrors";
import { parseApiError, toastApiError } from "@/shared/api/errors";
import { invalidateProjectBudget } from "@/shared/api/queryPolicy";

import type { CrewAssignment } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceOptimisticEntity,
  replaceEntityById,
} from "./project.query-utils";
import { buildOptimisticCrewAssignment } from "./project.optimistic";
import type {
  CrewAssignmentCreateDTO,
  CrewAssignmentUpdateDTO,
} from "../types/project.dto";

export const useCreateCrewAssignment = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CrewAssignmentCreateDTO) =>
      ProjectService.createCrewAssignment(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("crewAssignment");
      const queryKey = projectKeys.crewAssignments.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousCrewAssignments =
        queryClient.getQueryData<CrewAssignment[]>(queryKey);

      queryClient.setQueryData<CrewAssignment[]>(
        queryKey,
        (currentCrewAssignments = []) => [
          ...currentCrewAssignments,
          buildOptimisticCrewAssignment(data, optimisticId),
        ],
      );

      return { optimisticId, previousCrewAssignments };
    },
    onError: (error, _variables, context) => {
      toastApiError(error);
      if (context?.previousCrewAssignments) {
        queryClient.setQueryData(
          projectKeys.crewAssignments.byProject(projectId),
          context.previousCrewAssignments,
        );
      }
    },
    onSuccess: (assignment, _variables, context) => {
      queryClient.setQueryData<CrewAssignment[]>(
        projectKeys.crewAssignments.byProject(projectId),
        (currentCrewAssignments) =>
          replaceOptimisticEntity(
            currentCrewAssignments,
            context?.optimisticId,
            assignment,
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.crewAssignments.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      invalidateProjectBudget(queryClient, projectId);
    },
  });
};

export const useUpdateCrewAssignment = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CrewAssignmentUpdateDTO }) =>
      ProjectService.updateCrewAssignment(id, data),
    onMutate: async (variables) => {
      const queryKey = projectKeys.crewAssignments.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousCrewAssignments =
        queryClient.getQueryData<CrewAssignment[]>(queryKey);

      queryClient.setQueryData<CrewAssignment[]>(
        queryKey,
        (currentCrewAssignments = []) =>
          currentCrewAssignments.map((assignment) =>
            String(assignment.id) === variables.id
              ? { ...assignment, ...variables.data }
              : assignment,
          ),
      );

      return { previousCrewAssignments };
    },
    onError: (error, _variables, context) => {
      toastApiError(error);
      if (context?.previousCrewAssignments) {
        queryClient.setQueryData(
          projectKeys.crewAssignments.byProject(projectId),
          context.previousCrewAssignments,
        );
      }
    },
    onSuccess: (assignment, variables) => {
      queryClient.setQueryData<CrewAssignment[]>(
        projectKeys.crewAssignments.byProject(projectId),
        (currentCrewAssignments = []) =>
          replaceEntityById(currentCrewAssignments, variables.id, assignment) ??
          currentCrewAssignments,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.crewAssignments.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      invalidateProjectBudget(queryClient, projectId);
    },
  });
};

export const useDeleteCrewAssignment = (projectId: string) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteCrewAssignment(id),
    onMutate: async (id) => {
      const queryKey = projectKeys.crewAssignments.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousCrewAssignments =
        queryClient.getQueryData<CrewAssignment[]>(queryKey);

      queryClient.setQueryData<CrewAssignment[]>(
        queryKey,
        (currentCrewAssignments = []) =>
          removeEntityById(currentCrewAssignments, id) ?? [],
      );

      return { previousCrewAssignments };
    },
    onError: (error, _variables, context) => {
      const copy = financeErrorCopy(t, parseApiError(error).code);
      toastApiError(error, t, copy ? { description: copy } : {});
      if (context?.previousCrewAssignments) {
        queryClient.setQueryData(
          projectKeys.crewAssignments.byProject(projectId),
          context.previousCrewAssignments,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.crewAssignments.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      invalidateProjectBudget(queryClient, projectId);
    },
  });
};
