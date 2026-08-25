/**
 * @file offlinePrep.ts
 * @description What "get ready for rehearsal" actually means, in numbers.
 *
 * The scope is deliberately NOT "everything". A singer's archive grows every
 * season and the bulk of it is audio; promising a phone the whole library is a
 * promise storage quotas break, and the half that fails is invisible. What has
 * to work without signal is the concerts they are still singing — so that is the
 * scope, it is stated in plain counts before anything is taken, and a finished
 * concert is left where it is.
 *
 * Also the one place that pairs a download with its markings, so the dashboard
 * card and the per-concert control in the Songbook cannot drift apart on what a
 * complete download includes.
 * @module features/materials/lib
 */

import type { QueryClient } from "@tanstack/react-query";

import { downloadProjectForOffline } from "@/shared/offline/offlineClient";
import { prefetchEditionAnnotations } from "@/features/annotations";
import { getPiecePdfLinks } from "@/features/archive/constants/piecePdfs";

import type { MaterialsDashboardGroup } from "../types/materials.dto";

/** Concerts still ahead — the only ones worth a phone's storage. */
export const upcomingOfflineGroups = (
  groups: readonly MaterialsDashboardGroup[],
): MaterialsDashboardGroup[] =>
  groups.filter(
    (group) => group.project.status !== "DONE" && group.program.length > 0,
  );

export interface OfflineScope {
  concerts: number;
  pieces: number;
  /** Every voice, not just the singer's — blend and minus-mine need the choir. */
  tracks: number;
  scores: number;
}

/** The plain-language inventory shown BEFORE anything is downloaded. */
export const summarizeOfflineScope = (
  groups: readonly MaterialsDashboardGroup[],
): OfflineScope => {
  let pieces = 0;
  let tracks = 0;
  let scores = 0;
  for (const group of groups) {
    for (const item of group.program) {
      pieces += 1;
      tracks += item.piece.tracks.length;
      if (getPiecePdfLinks(item.piece).length > 0) scores += 1;
    }
  }
  return { concerts: groups.length, pieces, tracks, scores };
};

/**
 * One concert, complete: its assets through the service worker, then the
 * markings on the scores it binds. The marks are the reason this wrapper exists
 * — a downloaded score with the conductor's cues missing is the exact failure
 * the download is meant to prevent, and it is silent.
 */
export const downloadGroupWithMarks = async (
  group: MaterialsDashboardGroup,
  queryClient: QueryClient,
): Promise<{ cached: number; failed: number }> => {
  const outcome = await downloadProjectForOffline(group);
  await prefetchEditionAnnotations(
    queryClient,
    group.program.flatMap((item) =>
      getPiecePdfLinks(item.piece)
        .slice(0, 1)
        .map((pdf) => pdf.id),
    ),
  );
  return outcome;
};
