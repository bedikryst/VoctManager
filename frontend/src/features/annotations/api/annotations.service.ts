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
import { MARKS_SEEN_ENDPOINT } from "../lib/markSeen";
import { ANNOTATIONS_ENDPOINT } from "../lib/pendingMarks";
import type {
  AnnotationPatch,
  MarkFingerprint,
  MarksNews,
  NewAnnotation,
  ScoreAnnotation,
  SetAsideSet,
} from "../types/annotations.dto";

const projectPath = (projectId: string): string => `/api/projects/${projectId}/`;

/**
 * A mark write that has not been answered by then is treated as lost on the
 * network and goes to the offline queue, whose replays are idempotent. Writes on
 * one edition leave one at a time, so a request left hanging would hold every
 * stroke behind it, and the undo waiting on them.
 */
const WRITE = { timeout: 20_000 } as const;

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
      WRITE,
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
      WRITE,
    );
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`${ANNOTATIONS_ENDPOINT}${id}/`, WRITE);
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
      WRITE,
    );
    return response.data;
  },

  /**
   * Moves this reader's pointer on one edition forward to `at`, the newest
   * `content_at` their device drew. The server never moves it back.
   */
  seen: async (editionId: string, at: string): Promise<void> => {
    await api.post(MARKS_SEEN_ENDPOINT, { edition: editionId, at }, WRITE);
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
      WRITE,
    );
    return response.data.restored;
  },

  /** The sets of marks put aside on one edition, newest first. Managers only. */
  setAsideSets: async (editionId: string): Promise<SetAsideSet[]> => {
    const response = await api.get<SetAsideSet[]>(`${ANNOTATIONS_ENDPOINT}set_aside/`, {
      params: { edition: editionId },
    });
    return response.data;
  },

  /**
   * Puts every live mark on the edition that is not somebody's personal pencil
   * into one set. `archived_at` is null when there was nothing to put away.
   */
  setAside: async (
    editionId: string,
  ): Promise<{ archived_at: string | null; count: number }> => {
    const response = await api.post<{ archived_at: string | null; count: number }>(
      `${ANNOTATIONS_ENDPOINT}set_aside/`,
      { edition: editionId },
    );
    return response.data;
  },

  /** Brings one set back; to the choir its marks are new again. */
  restoreSet: async (editionId: string, archivedAt: string): Promise<number> => {
    const response = await api.post<{ restored: number }>(
      `${ANNOTATIONS_ENDPOINT}set_aside/restore/`,
      { edition: editionId, archived_at: archivedAt },
    );
    return response.data.restored;
  },

  /**
   * What "Powiadom chór" would send now. The conductor and managers only.
   * The cooldown left is read against the answer's own `Date`, so a device
   * clock running fast or slow cannot wake the button early or hold it late;
   * without that header it falls back to this device's clock.
   */
  marksNews: async (projectId: string): Promise<MarksNews> => {
    const response = await api.get<Omit<MarksNews, "cooldown_ms">>(
      `${projectPath(projectId)}marks_news/`,
    );
    const news = response.data;
    const end = news.next_allowed_at ? Date.parse(news.next_allowed_at) : Number.NaN;
    const header: unknown = response.headers["date"];
    const serverNow = typeof header === "string" ? Date.parse(header) : Number.NaN;
    const now = Number.isNaN(serverNow) ? Date.now() : serverNow;
    return {
      ...news,
      cooldown_ms: Number.isNaN(end) ? null : Math.max(0, end - now),
    };
  },

  /** Tells the live cast which pieces carry new marks. */
  notifyChoir: async (
    projectId: string,
  ): Promise<{ notified_at: string; recipients: number; pieces: number }> => {
    const response = await api.post<{
      notified_at: string;
      recipients: number;
      pieces: number;
    }>(`${projectPath(projectId)}notify_marks/`);
    return response.data;
  },
};
