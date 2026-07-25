/**
 * @file project.announcements.ts
 * @description React Query layer for the announcement queue's conductor surface.
 * On a live project a save changes the data at once but only accrues in the queue,
 * so a run of edits reaches the cast as one considered message. These hooks read
 * the review sheet (keyed to the current selection so its counts never lie about
 * what the confirm button will send), publish it, and abandon it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { toastApiError } from "@/shared/api/errors";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "./project.query-keys";
import { ProjectService } from "./project.service";

/**
 * The review sheet's preview, re-keyed by the selection it describes.
 *
 * The counts are the server's, never the client's: the same `plan()` that fans the
 * messages out produces the number on the confirm button, so the two cannot
 * disagree — which is the whole promise of the queue and would be lost the moment
 * the fold rule were mirrored in TypeScript. Unticking a line therefore recounts
 * against the server, and `keepPreviousData` holds the sheet steady while it does.
 * Typing a note costs nothing: only its *presence* changes the arithmetic, so the
 * key carries a boolean and flips once.
 */
export const useAnnouncementReview = (
  projectId: string,
  {
    enabled,
    exclude = [],
    hasNote = false,
  }: { enabled: boolean; exclude?: readonly string[]; hasNote?: boolean },
) =>
  useQuery({
    queryKey: projectKeys.announcements.review(projectId, exclude, hasNote),
    queryFn: () =>
      ProjectService.getAnnouncementReview(projectId, exclude, hasNote),
    enabled: Boolean(projectId) && enabled,
    placeholderData: keepPreviousData,
    ...RECONCILING_REFETCH,
  });

/**
 * Clears everything a publication or discard makes untrue: every cached preview of
 * this project's queue (one per selection the conductor tried), and the project
 * lists whose unannounced badge has just changed. The saved project data is
 * untouched — the queue only ever governed the announcement.
 *
 * The previews are *removed*, not invalidated. The hub's read is gated on the
 * project's own flag, so once the queue empties that query goes disabled — and a
 * disabled query keeps serving whatever it last held, which would leave the count
 * pill advertising changes that have already gone out.
 */
const useSettleQueue = (projectId: string) => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.removeQueries({
      queryKey: ["projects", String(projectId), "announcements"],
    });
    queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
  };
};

export const usePublishAnnouncements = (projectId: string) => {
  const settle = useSettleQueue(projectId);
  return useMutation({
    mutationFn: (payload: { note?: string; exclude?: readonly string[] }) =>
      ProjectService.publishAnnouncements(projectId, payload),
    onSuccess: settle,
    onError: (error) => toastApiError(error),
  });
};

export const useDiscardAnnouncements = (projectId: string) => {
  const settle = useSettleQueue(projectId);
  return useMutation({
    mutationFn: () => ProjectService.discardAnnouncements(projectId),
    onSuccess: settle,
    onError: (error) => toastApiError(error),
  });
};
