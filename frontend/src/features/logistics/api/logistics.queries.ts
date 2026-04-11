import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logisticsService } from "./logistics.service";
import { LocationCreateDto, LocationUpdateDto } from "../types/logistics.dto";

export const logisticsQueryKeys = {
  all: ["locations"] as const,
  lists: () => [...logisticsQueryKeys.all, "list"] as const,
};

export const useLocations = () => {
  return useQuery({
    queryKey: logisticsQueryKeys.lists(),
    queryFn: logisticsService.getLocations,
    staleTime: 1000 * 60 * 5, // 5 minutes (Logistics data rarely changes mid-session)
  });
};

export const useCreateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LocationCreateDto) =>
      logisticsService.createLocation(data),
    onSuccess: () => {
      // Invalidate cache to refetch the updated list
      queryClient.invalidateQueries({ queryKey: logisticsQueryKeys.lists() });
    },
  });
};
