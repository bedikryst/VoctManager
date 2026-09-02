/**
 * @file copydesk.service.ts
 * @description Transport for the copy desk. The desk READS the corpus and
 * writes proposals about it — it never writes the mirror, which only the
 * extractor's staff-only ingest may do.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/api/copydesk.service
 */

import api from "@/shared/api/api";
import type { CopyDeskContents } from "../types/copydesk.dto";

export const COPY_DESK_ENDPOINTS = {
  contents: "/api/copydesk/contents/",
  markSeen: "/api/copydesk/mark-seen/",
} as const;

export const CopyDeskService = {
  getContents: async (): Promise<CopyDeskContents> => {
    const { data } = await api.get<CopyDeskContents>(
      COPY_DESK_ENDPOINTS.contents,
    );
    return data;
  },

  /**
   * Stamps the visit the "new since last visit" state is measured from. Called
   * when the reader LEAVES the desk, not when they arrive: a segment that
   * appeared since last time has to survive being read, or the counter clears
   * itself before it has said anything.
   *
   * The stamp lives on the profile, server-side, for the same reason
   * `welcome_seen_at` does — a visit is a fact about the person, not about a
   * browser.
   */
  markSeen: async (): Promise<void> => {
    await api.post(COPY_DESK_ENDPOINTS.markSeen);
  },
};
