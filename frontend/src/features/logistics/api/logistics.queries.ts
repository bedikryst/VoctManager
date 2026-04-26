/**
 * @file logistics.queries.ts
 * @description React Query hooks for the Logistics module.
 */

import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { logisticsService } from "./logistics.service";
import type {
  LocationCreateDto,
  LocationUpdateDto,
} from "../types/logistics.dto";

export const logisticsQueryKeys = {
  all: ["locations"] as const,
  lists: () => [...logisticsQueryKeys.all, "list"] as const,
};

export const useLocations = () => {
  return useSuspenseQuery({
    queryKey: logisticsQueryKeys.lists(),
    queryFn: logisticsService.getLocations,
    staleTime: 1000 * 60 * 5,
    select: (locations) => (Array.isArray(locations) ? locations : locations ? [locations] : []),
  });
};

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
