/**
 * @file logistics.queries.ts
 * @description React Query hooks for the Logistics module.
 */

import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Project, Rehearsal } from "@/shared/types";
import { projectKeys } from "@/features/projects/api/project.queries";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { logisticsService } from "./logistics.service";
import type {
  LocationCreateDto,
  LocationDto,
  LocationUpdateDto,
} from "../types/logistics.dto";

export const logisticsQueryKeys = {
  all: ["locations"] as const,
  lists: () => [...logisticsQueryKeys.all, "list"] as const,
};

export const useLocations = () => {
  return useSuspenseQuery<LocationDto[]>({
    queryKey: logisticsQueryKeys.lists(),
    queryFn: logisticsService.getLocations,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Concerts + rehearsals consumed by the logistics atlas. Both reuse the shared
 * cache keys the projects/rehearsals features already populate, so the command
 * centre rides the existing cache instead of issuing duplicate requests.
 */
export const useLogisticsProjects = () =>
  useSuspenseQuery<Project[]>({
    queryKey: projectKeys.projects.all,
    queryFn: logisticsService.getProjects,
    staleTime: 1000 * 60 * 5,
  });

export const useLogisticsRehearsals = () =>
  useSuspenseQuery<Rehearsal[]>({
    queryKey: rehearsalKeys.rehearsals.all,
    queryFn: logisticsService.getRehearsals,
    staleTime: 1000 * 60 * 5,
  });

export const useCreateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LocationCreateDto) =>
      logisticsService.createLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsQueryKeys.lists() });
    },
  });
};

export const useUpdateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LocationUpdateDto }) =>
      logisticsService.updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsQueryKeys.lists() });
    },
  });
};

export const useDeleteLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => logisticsService.deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsQueryKeys.lists() });
    },
  });
};
