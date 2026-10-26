/**
 * @file replayPolicy.ts
 * @description What a failed write means, for the offline queue's replay loop
 * and for any feature deciding whether a live write should be queued.
 *
 * The distinction that matters is between an answer about the WRITE and an
 * answer about the SERVER. A 400 or 403 says this write will never be accepted,
 * so keeping it only wedges everything queued behind it. A 502 says nothing
 * about the write at all — it is what a deploy looks like for two minutes — and
 * dropping on it loses a rehearsal's marks to a restart. So server and network
 * trouble keep the write and back off, and the write is let go only once the
 * server has been answering it badly for a whole day.
 * @module shared/offline/replayPolicy
 */

import type { QueuedWrite } from "./useOfflineStore";

/** First retry after five seconds, doubling, never longer than five minutes apart. */
export const RETRY_BASE_MS = 5_000;
export const RETRY_CAP_MS = 5 * 60_000;

/**
 * How long the server may keep answering one write with an error before the
 * queue gives up on it. A span, never a count: the retry timer would burn any
 * plausible count during a deploy's few minutes of 502s.
 */
export const GIVE_UP_AFTER_MS = 24 * 60 * 60_000;

/**
 * `done`   — the answer means the write's purpose is already met (an erase of
 *            something already gone); dequeue it without a word.
 * `retry`  — keep it, back off, and hold everything queued behind it.
 * `reject` — the server refused this write for good; drop it and say so.
 */
export type WriteFailureVerdict = "done" | "retry" | "reject";

/** The HTTP status of a failed request, or null when no answer came back. */
export const statusOf = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : null;
};

export const classifyWriteFailure = (
  error: unknown,
  method: QueuedWrite["method"],
): WriteFailureVerdict => {
  const status = statusOf(error);
  if (status === null) return "retry";
  // 401 survives the token refresh only when the session is gone, and then the
  // logout wipes the queue anyway; until that happens it is not the write's fault.
  if (status === 401 || status === 408 || status === 429 || status >= 500) {
    return "retry";
  }
  if (status === 410) return "done";
  if (status === 404 && method === "DELETE") return "done";
  return "reject";
};

/** Backoff before the next try, given how many replays have already left. */
export const retryDelayMs = (attempts: number): number =>
  Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));
