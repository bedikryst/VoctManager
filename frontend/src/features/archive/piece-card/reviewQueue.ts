/**
 * @file reviewQueue.ts
 * @description The queue "Następne do przeglądu" walks: every piece with an
 * edition awaiting review, in the library's order, wrapping round from the
 * last to the first.
 * @module features/archive/piece-card/reviewQueue
 */

import { INGESTION_STATUS, type Piece } from "@/shared/types";

const isAwaitingReview = (piece: Piece): boolean =>
  (piece.editions ?? []).some(
    (edition) => edition.ingestion_status === INGESTION_STATUS.AWAITING,
  );

/**
 * The piece after `currentId` in the review queue, or null when no other piece
 * is waiting. A record that is not in the queue itself starts it from the top.
 */
export const findNextAwaiting = (
  pieces: readonly Piece[],
  currentId: string,
): Piece | null => {
  const awaiting = pieces.filter(isAwaitingReview);
  const currentIndex = awaiting.findIndex((piece) => String(piece.id) === currentId);
  const next =
    currentIndex === -1
      ? awaiting[0]
      : awaiting[(currentIndex + 1) % awaiting.length];
  return next && String(next.id) !== currentId ? next : null;
};
