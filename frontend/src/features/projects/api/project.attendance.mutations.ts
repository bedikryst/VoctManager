/**
 * @file project.attendance.mutations.ts
 * @description React Query mutations for project rehearsal attendance.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import type { Attendance } from "@/shared/types";

import { ProjectService } from "./project.service";
import {
  buildOptimisticId,
  removeEntityById,
  replaceEntityById,
} from "./project.query-utils";
import { buildOptimisticAttendance } from "./project.optimistic";
import type {
  AttendanceCreateDTO,
  AttendanceUpdateDTO,
} from "../types/project.dto";

export const useCreateAttendance = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AttendanceCreateDTO) =>
      ProjectService.createAttendance(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("attendance");
      const queryKey = rehearsalKeys.attendances.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousAttendances = queryClient.getQueryData<Attendance[]>(
        queryKey,
      );

      queryClient.setQueryData<Attendance[]>(
        queryKey,
        (currentAttendances = []) => [
          ...currentAttendances.filter(
            (attendance) =>
              !(
                String(attendance.rehearsal) === data.rehearsal &&
                String(attendance.participation) === data.participation
              ),
          ),
          buildOptimisticAttendance(data, optimisticId),
        ],
      );

      return { optimisticId, previousAttendances };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousAttendances) {
        queryClient.setQueryData(
          rehearsalKeys.attendances.byProject(projectId),
          context.previousAttendances,
        );
      }
    },
    onSuccess: (attendance, _variables, context) => {
      queryClient.setQueryData<Attendance[]>(
        rehearsalKeys.attendances.byProject(projectId),
        (currentAttendances = []) =>
          replaceEntityById(
            currentAttendances,
            context?.optimisticId ?? "",
            attendance,
          ) ?? [...currentAttendances, attendance],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: rehearsalKeys.attendances.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: rehearsalKeys.rehearsals.byProject(projectId),
      });
    },
  });
};

export const useUpdateAttendance = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AttendanceUpdateDTO }) =>
      ProjectService.updateAttendance(id, data),
    onMutate: async (variables) => {
      const queryKey = rehearsalKeys.attendances.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousAttendances = queryClient.getQueryData<Attendance[]>(
        queryKey,
      );

      queryClient.setQueryData<Attendance[]>(
        queryKey,
        (currentAttendances = []) =>
          currentAttendances.map((attendance) =>
            String(attendance.id) === variables.id
              ? { ...attendance, ...variables.data }
              : attendance,
          ),
      );

      return { previousAttendances };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousAttendances) {
        queryClient.setQueryData(
          rehearsalKeys.attendances.byProject(projectId),
          context.previousAttendances,
        );
      }
    },
    onSuccess: (attendance, variables) => {
      queryClient.setQueryData<Attendance[]>(
        rehearsalKeys.attendances.byProject(projectId),
        (currentAttendances = []) =>
          replaceEntityById(currentAttendances, variables.id, attendance) ??
          currentAttendances,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: rehearsalKeys.attendances.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: rehearsalKeys.rehearsals.byProject(projectId),
      });
    },
  });
};

export const useDeleteAttendance = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteAttendance(id),
    onMutate: async (id) => {
      const queryKey = rehearsalKeys.attendances.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousAttendances = queryClient.getQueryData<Attendance[]>(
        queryKey,
      );

      queryClient.setQueryData<Attendance[]>(
        queryKey,
        (currentAttendances = []) =>
          removeEntityById(currentAttendances, id) ?? [],
      );

      return { previousAttendances };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousAttendances) {
        queryClient.setQueryData(
          rehearsalKeys.attendances.byProject(projectId),
          context.previousAttendances,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: rehearsalKeys.attendances.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: rehearsalKeys.rehearsals.byProject(projectId),
      });
    },
  });
};
