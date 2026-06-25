/**
 * @file materials.queries.ts
 * @description React Query hooks for the Materials domain.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialsService } from "./materials.service";
import { useOfflineStore } from "@/app/store/useOfflineStore";
import { isLikelyOfflineError } from "@/shared/offline/offlineClient";
import {
  PERSONAL_READMODEL_KEYS,
  RECONCILING_REFETCH,
} from "@/shared/api/queryPolicy";
import type {
  MaterialsDashboardItem,
  MaterialsReadinessStatus,
} from "../types/materials.dto";

export const materialsKeys = {
  dashboard: PERSONAL_READMODEL_KEYS.materialsDashboard,
};

export const useArtistMaterialsDashboard = (enabled = true) =>
  useQuery({
    queryKey: materialsKeys.dashboard,
    queryFn: MaterialsService.getArtistMaterialsDashboard,
    enabled,
    // Personal read-model joined server-side from the chorister's participations
    // and castings — both of which a manager changes from another session. Must
    // reconcile on the chorister's next mount/focus, not after the 24h cache
    // ages out, or a newly-assigned divisi piece stays hidden.
    ...RECONCILING_REFETCH,
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

    onError: (error, variables, context) => {
      // Offline tap: keep the optimistic patch and queue the write for replay —
      // rolling back would punish the chorister for having no signal.
      if (isLikelyOfflineError(error)) {
        useOfflineStore.getState().enqueueWrite({
          kind: "readiness",
          method: "PUT",
          url: `/api/participations/${variables.participationId}/readiness/`,
          body: { piece: variables.pieceId, status: variables.status },
          dedupeKey: `readiness:${variables.participationId}:${variables.pieceId}`,
          label: "Gotowość utworu",
        });
        return;
      }
      if (context?.snapshot) {
        queryClient.setQueryData(materialsKeys.dashboard, context.snapshot);
      }
    },

    onSettled: () => {
      // Skip the refetch while offline — it would only fail and churn the cache;
      // the queued replay invalidates on reconnect.
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      void queryClient.invalidateQueries({ queryKey: materialsKeys.dashboard });
    },
  });
};
