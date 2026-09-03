/**
 * @file copydesk.queries.ts
 * @description Cache keys, reads and the desk's three writes — the autosave, the
 * withdrawal, and the digest an editor raises when they have finished.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/api/copydesk.queries
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import { CopyDeskService } from "./copydesk.service";
import type {
  CopyDeskContents,
  CopyDeskNotifyResult,
  CopyDeskProposal,
  CopyDeskProposalWrite,
  CopyDeskProposalWritten,
  CopyDeskQueue,
  CopyDeskReviewWrite,
  CopyDeskSegment,
  CopyDeskSegments,
} from "../types/copydesk.dto";
import { isOpen } from "../lib/proposals";

export const copyDeskKeys = {
  root: ["copydesk"] as const,
  contents: () => ["copydesk", "contents"] as const,
  segments: (scope: string) => ["copydesk", "segments", scope] as const,
  queue: () => ["copydesk", "queue"] as const,
};

/**
 * Counts move whenever another editor writes, whenever the reviewer settles
 * something, and whenever `copy:sync` refreshes the mirror — none of which this
 * session can see happen. Short staleness plus the reconciling tier, so a desk
 * left open over a sitting reports the corpus as it now stands.
 */
const CONTENTS_STALE = 60 * 1000;

/**
 * The desk's gate as well as its first read: the shell asks this once, and the
 * 403 it can answer with IS the refusal screen. Both pages then read the same
 * cache entry rather than asking again.
 *
 * `retry: false` because the failure this actually meets is a permission, and a
 * refusal is final — three more attempts change nothing and delay the screen
 * that explains it. A network failure keeps its own recovery (the refetch
 * offered beside the error).
 */
export const useCopyDeskContents = (): UseQueryResult<CopyDeskContents> =>
  useQuery({
    queryKey: copyDeskKeys.contents(),
    queryFn: CopyDeskService.getContents,
    staleTime: CONTENTS_STALE,
    retry: false,
    ...RECONCILING_REFETCH,
  });

/**
 * One page of the corpus, in all three languages.
 *
 * `persist: false` keeps it out of the panel's 24-hour localStorage snapshot.
 * The corpus is a projection of git and the desk's whole job is to work against
 * what the repository holds NOW; a day-old copy restored on a cold boot would
 * put an editor's paragraph next to a source that has moved, which is precisely
 * the silence the source hash exists to break. It is also six pages of prose
 * that no chorister's offline panel has any use for.
 */
export const useCopyDeskSegments = (
  scope: string,
): UseQueryResult<CopyDeskSegments> =>
  useQuery({
    queryKey: copyDeskKeys.segments(scope),
    queryFn: () => CopyDeskService.getSegments(scope),
    enabled: Boolean(scope),
    meta: { persist: false },
    staleTime: CONTENTS_STALE,
    ...RECONCILING_REFETCH,
  });

/**
 * The reviewer's queue: everything open across every page, with the standing
 * patch beside it.
 *
 * `persist: false` for the same reason the corpus is not persisted — these rows
 * are somebody's unsettled words and a day-old copy restored on a cold boot
 * would offer a verdict on wording that has since been revised or withdrawn.
 */
export const useCopyDeskQueue = (
  enabled: boolean,
): UseQueryResult<CopyDeskQueue> =>
  useQuery({
    queryKey: copyDeskKeys.queue(),
    queryFn: CopyDeskService.getQueue,
    enabled,
    meta: { persist: false },
    staleTime: CONTENTS_STALE,
    ...RECONCILING_REFETCH,
  });

/**
 * A verdict, and the one write on the desk that refetches rather than patching.
 *
 * The autosave patches its cache because it moves one field of 213 and knows
 * exactly what changed. A verdict moves three things at once — the entry leaves
 * the queue, the patch summary gains a field, the contents list's counts shift
 * — and two of them are the server's arithmetic (a Polish acceptance also
 * restates which translations are stale). A hand-rolled answer to any of that
 * is how the queue would start disagreeing with the band above it, and the read
 * it costs is the queue, which is only ever as long as the work that is waiting.
 */
export const useReviewProposal = (): UseMutationResult<
  CopyDeskProposalWritten,
  Error,
  CopyDeskReviewWrite
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CopyDeskService.reviewProposal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: copyDeskKeys.queue() });
      void queryClient.invalidateQueries({ queryKey: copyDeskKeys.contents() });
      // The editor's own page shows the settled chip on the cell it was written
      // in; leaving it warm would show the proposal as still open there.
      void queryClient.invalidateQueries({
        queryKey: ["copydesk", "segments"],
      });
    },
  });
};

/** The proposal the server now holds, as the desk can honestly describe it. */
const writtenProposal = (
  written: CopyDeskProposalWritten,
  payload: CopyDeskProposalWrite,
  previous: CopyDeskProposal | null,
): CopyDeskProposal => ({
  id: written.id,
  value: payload.value,
  comment: payload.comment,
  status: written.status,
  author_id: previous?.author_id ?? null,
  author_name: previous?.author_name ?? "",
  is_mine: true,
  // Not a guess: the server stamps a proposal against the Polish as it stands at
  // the moment of the write, so a value saved a millisecond ago renders the
  // current source by construction.
  is_stale: false,
  source_known: true,
  updated_at: new Date().toISOString(),
  reviewed_at: null,
  applied_at: null,
});

/**
 * The autosave.
 *
 * The response carries an id and a status, so the cache is patched rather than
 * refetched: one page is ~213 rows and re-reading all of them every time a
 * sentence settles would put the desk's own network traffic between the editor
 * and their next paragraph.
 *
 * What the patch deliberately does NOT do is recompute staleness. Editing the
 * Polish invalidates the two translations built on it, and that verdict belongs
 * to the server (it hashes the value under the same normalization the extractor
 * uses). The reconciling tier fetches it back on the next mount or window focus;
 * inventing a second, hand-rolled answer here is how the desk would start
 * disagreeing with the digest about which rows are out of date.
 */
export const useSaveProposal = (
  scope: string,
): UseMutationResult<
  CopyDeskProposalWritten,
  Error,
  CopyDeskProposalWrite
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CopyDeskService.saveProposal,
    onSuccess: (written, payload) => {
      let isFirstOnThisSegment = false;

      queryClient.setQueryData<CopyDeskSegments>(
        copyDeskKeys.segments(scope),
        (current) => {
          if (!current) return current;
          return {
            segments: current.segments.map((segment) => {
              if (segment.id !== payload.segment_id) return segment;
              const previous =
                segment.proposals.find(
                  (proposal) => proposal.is_mine && isOpen(proposal),
                ) ?? null;
              isFirstOnThisSegment = previous === null;
              return {
                ...segment,
                proposals: [
                  writtenProposal(written, payload, previous),
                  ...segment.proposals.filter(
                    (proposal) => !(proposal.is_mine && isOpen(proposal)),
                  ),
                ],
              } satisfies CopyDeskSegment;
            }),
          };
        },
      );

      // The contents list counts segments that have been TOUCHED, so only the
      // first write on a given segment moves it. Revising the same paragraph
      // twenty times changes nothing there, and refetching the census each time
      // would be twenty reads answering the same number.
      if (isFirstOnThisSegment) {
        void queryClient.invalidateQueries({
          queryKey: copyDeskKeys.contents(),
        });
      }
    },
  });
};

/** Taking back one's own open proposal: the segment returns to what git holds. */
export const useWithdrawProposal = (
  scope: string,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CopyDeskService.withdrawProposal,
    onSuccess: (_result, proposalId) => {
      queryClient.setQueryData<CopyDeskSegments>(
        copyDeskKeys.segments(scope),
        (current) =>
          current
            ? {
                segments: current.segments.map((segment) => ({
                  ...segment,
                  proposals: segment.proposals.filter(
                    (proposal) => proposal.id !== proposalId,
                  ),
                })),
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: copyDeskKeys.contents() });
    },
  });
};

/**
 * "I have finished" — the digest, raised now rather than half an hour after the
 * last keystroke. It writes nothing an editor could lose by not pressing it.
 */
export const useNotifyReviewers = (): UseMutationResult<
  CopyDeskNotifyResult,
  Error,
  void
> =>
  useMutation({
    mutationFn: CopyDeskService.notifyReviewers,
  });

/**
 * "I have read this page" — the watermark the contents list divides on.
 *
 * Both caches are invalidated rather than patched, because the mark moves more
 * than a number: the contents row changes side, and every `is_new` and
 * `is_changed` on the page it names is recomputed against the new moment. Both
 * are the server's arithmetic over `created_at`/`updated_at`, and a hand-rolled
 * second answer is how a row would keep its "Nowe" chip on a page the list has
 * already moved to the reviewed half.
 */
export const useMarkScopeSeen = (
  scope: string,
): UseMutationResult<void, Error, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => CopyDeskService.markScopeSeen(scope),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: copyDeskKeys.contents() });
      void queryClient.invalidateQueries({
        queryKey: copyDeskKeys.segments(scope),
      });
    },
  });
};
