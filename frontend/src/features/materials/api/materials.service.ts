/**
 * @file materials.service.ts
 * @description Pure HTTP service for the Materials domain.
 * Single endpoint — all aggregation is handled server-side.
 */

import api from "@/shared/api/api";
import type {
  MaterialsDashboardItem,
  MaterialsReadinessStatus,
} from "../types/materials.dto";

export const MaterialsService = {
  getArtistMaterialsDashboard: async (): Promise<MaterialsDashboardItem[]> => {
    const response = await api.get<MaterialsDashboardItem[]>(
      "/api/participations/materials-dashboard/",
    );
    return response.data;
  },

  setPieceReadiness: async (
    participationId: string,
    pieceId: string,
    status: MaterialsReadinessStatus,
  ): Promise<{ piece: string; status: MaterialsReadinessStatus }> => {
    const response = await api.put<{
      piece: string;
      status: MaterialsReadinessStatus;
    }>(`/api/participations/${participationId}/readiness/`, {
      piece: pieceId,
      status,
    });
    return response.data;
  },
};
