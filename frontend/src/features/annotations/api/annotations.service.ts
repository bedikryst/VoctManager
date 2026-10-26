/**
 * @file annotations.service.ts
 * @description Pure HTTP service for score annotations. Reads are role-scoped
 * server-side (choristers receive the `shared` layer plus their OWN `personal`
 * marks, only for editions they still have live access to; managers never
 * receive other users' personal marks). Writes: managers own shared/conductor;
 * everyone owns their personal layer — anything else is 403. `clear` is
 * role-aware server-side (managers wipe shared+conductor, choristers their own
 * personal marks).
 * @module features/annotations/api
 */

import api from "@/shared/api/api";
import { ANNOTATIONS_ENDPOINT } from "../lib/pendingMarks";
import type {
  AnnotationPatch,
  MarkFingerprint,
  NewAnnotation,
  ScoreAnnotation,
} from "../types/annotations.dto";

export const AnnotationsService = {
  list: async (editionId: string): Promise<ScoreAnnotation[]> => {
    const response = await api.get<ScoreAnnotation[]>(ANNOTATIONS_ENDPOINT, {
      params: { edition: editionId },
    });
    return response.data;
  },

  /**
   * Count + newest touch of everything this reader may see on one edition —
   * about sixty bytes, so an open score stand can keep up with the rehearsal
   * without moving the whole markup every twenty seconds.
   */
  fingerprint: async (editionId: string): Promise<MarkFingerprint> => {
    const response = await api.get<MarkFingerprint>(
      `${ANNOTATIONS_ENDPOINT}fingerprint/`,
      { params: { edition: editionId } },
    );
    return response.data;
  },

  create: async (
    payload: NewAnnotation & { id?: string },
  ): Promise<ScoreAnnotation> => {
    const response = await api.post<ScoreAnnotation>(
      ANNOTATIONS_ENDPOINT,
      payload,
    );
    return response.data;
  },

  update: async (
    id: string,
    patch: AnnotationPatch,
  ): Promise<ScoreAnnotation> => {
    const response = await api.patch<ScoreAnnotation>(
      `${ANNOTATIONS_ENDPOINT}${id}/`,
      patch,
    );
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`${ANNOTATIONS_ENDPOINT}${id}/`);
  },

  /**
   * Wipes the named marks, within the caller's clear scope. Naming them is what
   * keeps a late replay from taking marks drawn after the gesture.
   */
  clear: async (
    editionId: string,
    ids: readonly string[],
  ): Promise<{ deleted: number; ids: string[] }> => {
    const response = await api.post<{ deleted: number; ids: string[] }>(
      `${ANNOTATIONS_ENDPOINT}clear/`,
      { edition: editionId, ids },
    );
    return response.data;
  },

  /**
   * Brings erased marks back with their ids, authors and stacking order. Ids
   * the server never had, or that the caller may no longer write, are skipped;
   * the answer lists what came back.
   */
  restore: async (ids: readonly string[]): Promise<ScoreAnnotation[]> => {
    const response = await api.post<{ restored: ScoreAnnotation[] }>(
      `${ANNOTATIONS_ENDPOINT}restore/`,
      { ids },
    );
    return response.data.restored;
  },
};
