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
 * Also the one place that says what "complete" means — the concert book, the
 * loose scores, the voices and the markings on all of them — so the dashboard
 * card and the per-concert control in the Songbook cannot drift apart on it.
 * @module features/materials/lib
 */

import type { QueryClient } from "@tanstack/react-query";

import { downloadProjectForOffline } from "@/shared/offline/offlineClient";
import type { OfflineAsset } from "@/shared/offline/swProtocol";
import { prefetchEditionAnnotations } from "@/features/annotations";
import { getPiecePdfLinks } from "@/features/archive/constants/piecePdfs";
import { projectKeys } from "@/features/projects/api/project.query-keys";
import {
  ProjectService,
  scoreBookMapUrl,
  scoreBookPdfUrl,
} from "@/features/projects/api/project.service";

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

interface BinderPlan {
  /** Map + bytes, in that order — see below. */
  assets: OfflineAsset[];
  /** The editions the book actually binds, which is not always the obvious one. */
  editions: string[];
}

const NO_BINDER: BinderPlan = { assets: [], editions: [] };

/**
 * What it takes to have the concert BOOK, not just the loose scores, on a device
 * with no signal — resolved before anything is stored, because none of it can be
 * named until the server says which build this device is taking.
 *
 * The map is read first and deliberately: it carries the stamp that names the
 * bytes, so map and book are taken under one identity and cannot later disagree
 * about which build the reader is holding. It is also the only thing that knows
 * which EDITIONS the binder bound — a conductor may pin one per piece, so the
 * songbook's "first edition of each piece" is a guess, and a wrong guess means a
 * book whose pages carry no markings.
 *
 * The book is fetched exactly once here. Composing it is expensive on the server
 * (front matter, assembly, and a watermark bearing this reader's name), and it is
 * far too big to re-pull on every open — which is precisely why it is worth
 * storing rather than streaming.
 */
const planBinder = async (
  group: MaterialsDashboardGroup,
  queryClient: QueryClient,
): Promise<BinderPlan> => {
  const projectId = group.project.id;
  if (!group.project.has_score_pdf) return NO_BINDER;
  try {
    const map = await queryClient.fetchQuery({
      queryKey: projectKeys.scorePackage.map(projectId),
      queryFn: () => ProjectService.getScoreMap(projectId),
    });
    // No stamp = nothing this device may keep a copy of. The concert's audio and
    // loose scores still go; a missing book is not a failed download.
    if (!map.stamp) return NO_BINDER;
    return {
      // The map is listed even though the fetch above already put it in the
      // worker's cache: it belongs to the manifest, so that removing the
      // concert removes the whole binder and not just its heavy half.
      assets: [
        { url: scoreBookMapUrl(projectId), kind: "score" },
        { url: scoreBookPdfUrl(projectId, map.stamp), kind: "score" },
      ],
      editions: map.pages.map((page) => page.edition),
    };
  } catch {
    return NO_BINDER;
  }
};

/**
 * One concert, complete: the binder resolved, then every asset through the
 * service worker, then the markings on the scores it binds. The marks are the
 * reason this wrapper exists — a downloaded score with the conductor's cues
 * missing is the exact failure the download is meant to prevent, and it is
 * silent.
 */
export const downloadGroupWithMarks = async (
  group: MaterialsDashboardGroup,
  queryClient: QueryClient,
): Promise<{ cached: number; failed: number }> => {
  const binder = await planBinder(group, queryClient);
  const outcome = await downloadProjectForOffline(group, binder.assets);
  await prefetchEditionAnnotations(queryClient, [
    ...group.program.flatMap((item) =>
      getPiecePdfLinks(item.piece)
        .slice(0, 1)
        .map((pdf) => pdf.id),
    ),
    ...binder.editions,
  ]);
  return outcome;
};
