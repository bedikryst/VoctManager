/**
 * @file markSeen.ts
 * @description What is new to one reader on one edition, and the queue entry
 * that moves their read pointer when there is no signal to send it.
 *
 * New is a mark addressed to the reader — the choir's layer, or the cues for
 * whoever runs the evening and the answers to them — written by someone else,
 * whose `content_at` is later than how far they had read. Their own marks are
 * never news to them, and neither is a mark only moved, resized or recoloured:
 * the server leaves `content_at` alone for those.
 *
 * The pointer only ever moves to a `content_at` the device drew, never to the
 * device's clock: a phone set an hour fast would otherwise swallow everything
 * the conductor writes in that hour.
 * @module features/annotations/lib
 */

import type { NewQueuedWrite, QueuedWrite } from "@/shared/offline/useOfflineStore";

import { ANNOTATIONS_ENDPOINT } from "./pendingMarks";
import type { ScoreAnnotation } from "../types/annotations.dto";

export const MARKS_SEEN_ENDPOINT = `${ANNOTATIONS_ENDPOINT}seen/`;

/** The layers written TO a reader rather than by them. */
const ADDRESSED_LAYERS: ReadonlySet<string> = new Set(["shared", "leader"]);

/**
 * An ISO timestamp as an instant, or null. Compared as instants because the
 * fingerprint and the rows reach the client through different serializers,
 * which spell the same moment differently.
 */
export const timeOf = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
};

/** A mark somebody else wrote for this reader to read. */
export const isAddressedTo = (
  mark: ScoreAnnotation,
  userId: string | null,
): boolean => ADDRESSED_LAYERS.has(mark.layer_name) && mark.created_by !== userId;

/** Whether the mark says something later than `since` (an instant). */
export const isNewSince = (mark: ScoreAnnotation, since: number): boolean => {
  const at = timeOf(mark.content_at);
  return at !== null && at > since;
};

/**
 * The newest `content_at` among these marks, spelled as the server spelled it,
 * so it can go back to the server verbatim.
 */
export const newestContent = (
  marks: readonly ScoreAnnotation[],
): string | null => {
  let newest: string | null = null;
  let newestTime = Number.NEGATIVE_INFINITY;
  for (const mark of marks) {
    const time = timeOf(mark.content_at);
    if (time !== null && time > newestTime && mark.content_at) {
      newest = mark.content_at;
      newestTime = time;
    }
  }
  return newest;
};

/** Edition pages these marks sit on, ascending, each once. */
export const pagesOf = (marks: readonly ScoreAnnotation[]): number[] =>
  [...new Set(marks.map((mark) => mark.page_number))].sort((a, b) => a - b);

interface QueuedSeen {
  editionId: string;
  at: string;
}

const isQueuedSeen = (meta: unknown): meta is QueuedSeen => {
  if (typeof meta !== "object" || meta === null) return false;
  const value = meta as Record<string, unknown>;
  return typeof value.editionId === "string" && typeof value.at === "string";
};

/**
 * The queue entry for a `seen` that could not be sent. One per edition: leaving
 * the same score twice without signal replaces the earlier entry, keeping
 * whichever reached further, because the order the reader left in says nothing
 * about how far they read.
 */
export const queuedSeen = (
  queue: readonly QueuedWrite[],
  editionId: string,
  at: string,
  label: string,
): NewQueuedWrite => {
  const dedupeKey = `annotation-seen:${editionId}`;
  const held = queue.find((write) => write.dedupeKey === dedupeKey)?.meta;
  const heldAt = isQueuedSeen(held) ? held.at : null;
  const furthest =
    heldAt !== null &&
    (timeOf(heldAt) ?? Number.NEGATIVE_INFINITY) > (timeOf(at) ?? Number.NEGATIVE_INFINITY)
      ? heldAt
      : at;
  return {
    kind: "annotation_seen",
    method: "POST",
    url: MARKS_SEEN_ENDPOINT,
    body: { edition: editionId, at: furthest },
    dedupeKey,
    label,
    background: true,
    meta: { editionId, at: furthest } satisfies QueuedSeen,
  };
};
