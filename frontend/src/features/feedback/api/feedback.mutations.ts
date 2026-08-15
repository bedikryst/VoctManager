/**
 * @file feedback.mutations.ts
 * @description Submitting a report, including from a church basement with no
 * signal.
 *
 * A dropped report is worse than no widget at all: the member believes they
 * told us, and we never heard it. So a network failure queues the write rather
 * than surfacing an error, and the reporter is told it will be sent — which is
 * true, the shell drains the queue on reconnect.
 * @module features/feedback/api/feedback.mutations
 */

import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useOfflineStore } from "@/app/store/useOfflineStore";
import { isLikelyOfflineError } from "@/shared/offline/offlineClient";
import { FeedbackService, FEEDBACK_ENDPOINT } from "./feedback.service";
import type { FeedbackReportPayload } from "../types/feedback.dto";

/** How the report was accepted — the sheet says something different for each. */
export type FeedbackSubmitOutcome = "sent" | "queued";

export const useSubmitFeedback = (): UseMutationResult<
  FeedbackSubmitOutcome,
  Error,
  FeedbackReportPayload
> =>
  useMutation<FeedbackSubmitOutcome, Error, FeedbackReportPayload>({
    mutationFn: async (payload) => {
      try {
        await FeedbackService.submit(payload);
        return "sent";
      } catch (error) {
        if (!isLikelyOfflineError(error)) throw error;

        useOfflineStore.getState().enqueueWrite({
          kind: "feedback",
          method: "POST",
          url: FEEDBACK_ENDPOINT,
          body: payload,
          // Unique per report: reports are not idempotent state like a readiness
          // tap, and collapsing two of them on a shared key would silently throw
          // one away — the exact failure this queue exists to prevent.
          dedupeKey: `feedback:${payload.context.captured_at}:${payload.body.length}`,
          label: "Zgłoszenie",
        });
        return "queued";
      }
    },
  });
