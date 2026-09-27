/**
 * @file vocalRange.service.ts
 * @description The singer's own range proposal. First-person only: the server
 * writes it to the caller's artist row and refuses anyone who does not sing.
 * @module features/vocal-range/api/vocalRange.service
 */

import api from "@/shared/api/api";

import type { VocalRangeSubmission } from "../lib/rangeDraft";

export const vocalRangeService = {
  /** Overwrites any earlier proposal and restamps it. */
  submit: async (submission: VocalRangeSubmission): Promise<void> => {
    await api.put("/api/artists/me/vocal-range/", submission);
  },
};
