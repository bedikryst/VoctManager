/**
 * @file materials.queries.ts
 * @description React Query hooks for the Materials domain.
 */

import { useQuery } from "@tanstack/react-query";
import { MaterialsService } from "./materials.service";

export const materialsKeys = {
  dashboard: ["materials", "dashboard"] as const,
};

export const useArtistMaterialsDashboard = (enabled = true) =>
  useQuery({
    queryKey: materialsKeys.dashboard,
    queryFn: MaterialsService.getArtistMaterialsDashboard,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
