/**
 * @file annotations.service.ts
 * @description Pure HTTP service for score annotations. Reads are role-scoped
 * server-side (choristers receive only the `shared` layer, and only for editions
 * they still have live access to); writes are manager-only and 403 otherwise.
 * @module features/annotations/api
 */

import api from "@/shared/api/api";
import type { NewAnnotation, ScoreAnnotation } from "../types/annotations.dto";

export const AnnotationsService = {
  list: async (editionId: string): Promise<ScoreAnnotation[]> => {
    const response = await api.get<ScoreAnnotation[]>(
      "/api/archive/annotations/",
      { params: { edition: editionId } },
    );
    return response.data;
  },

  create: async (payload: NewAnnotation): Promise<ScoreAnnotation> => {
    const response = await api.post<ScoreAnnotation>(
      "/api/archive/annotations/",
      payload,
    );
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/archive/annotations/${id}/`);
  },

  clear: async (editionId: string): Promise<{ deleted: number }> => {
    const response = await api.post<{ deleted: number }>(
      "/api/archive/annotations/clear/",
      { edition: editionId },
    );
    return response.data;
  },
};
