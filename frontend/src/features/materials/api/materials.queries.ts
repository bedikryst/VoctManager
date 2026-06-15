/**
 * @file materials.queries.ts
 * @description React Query hooks for the Materials domain.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialsService } from "./materials.service";
import type {
  MaterialsDashboardItem,
  MaterialsReadinessStatus,
} from "../types/materials.dto";

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

interface ReadinessVariables {
  participationId: string;
  pieceId: string;
  status: MaterialsReadinessStatus;
}

/**
 * Optimistic readiness upsert: the dashboard cache is patched immediately so
 * the segmented control answers the tap with zero latency (rehearsal-room UX),
 * and rolled back if the server rejects the write.
 */
export const useSetPieceReadiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ participationId, pieceId, status }: ReadinessVariables) =>
      MaterialsService.setPieceReadiness(participationId, pieceId, status),

    onMutate: async ({ participationId, pieceId, status }) => {
      await queryClient.cancelQueries({ queryKey: materialsKeys.dashboard });
      const snapshot = queryClient.getQueryData<MaterialsDashboardItem[]>(
        materialsKeys.dashboard,
      );

      queryClient.setQueryData<MaterialsDashboardItem[]>(
        materialsKeys.dashboard,
        (old = []) =>
          old.map((item) =>
            item.participation_id === participationId
              ? {
                  ...item,
                  program: item.program.map((pi) =>
                    pi.piece.id === pieceId
                      ? { ...pi, piece: { ...pi.piece, my_readiness: status } }
                      : pi,
                  ),
                }
              : item,
          ),
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(materialsKeys.dashboard, context.snapshot);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: materialsKeys.dashboard });
    },
  });
};
