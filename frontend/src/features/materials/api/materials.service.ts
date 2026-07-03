/**
 * @file materials.service.ts
 * @description Pure HTTP service for the Materials domain.
 * Single endpoint — all aggregation is handled server-side.
 */

import api from "@/shared/api/api";
import type {
  MaterialsDashboardItem,
  MaterialsReadinessStatus,
  MaterialsStartingPitch,
} from "../types/materials.dto";

export const MaterialsService = {
  getArtistMaterialsDashboard: async (): Promise<MaterialsDashboardItem[]> => {
    const response = await api.get<MaterialsDashboardItem[]>(
      "/api/participations/materials-dashboard/",
    );
    return response.data;
  },

  /**
   * Fetches a score-edition PDF through the authenticated, status-aware gate
   * (`/api/materials/scores/<id>/download/`). Going through the axios instance
   * gives us cookie auth + silent token refresh — unlike a bare <a> navigation,
   * which dies on the new tab the moment the access cookie expires. Feeds the
   * in-app PdfViewer so the chorister follows the score without leaving practice.
   */
  fetchScoreEditionBlob: async (editionId: string): Promise<Blob> => {
    const response = await api.get(
      `/api/materials/scores/${editionId}/download/`,
      { responseType: "blob" },
    );
    return response.data as Blob;
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

  /**
   * Persist the conductor's rehearsal starting pitches on the piece (archive
   * write endpoint — manager-gated server-side). Kept here rather than in the
   * archive feature so the rehearsal dock stays inside the materials slice.
   */
  updateStartingPitches: async (
    pieceId: string,
    pitches: MaterialsStartingPitch[],
  ): Promise<void> => {
    await api.patch(`/api/pieces/${pieceId}/`, { starting_pitches: pitches });
  },
};
