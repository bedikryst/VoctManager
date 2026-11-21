/**
 * @file pieceSequence.ts
 * @description Where the open piece stands in the list the manager walks, and
 * its neighbours there: the library's rows under the filters the card was
 * opened with, or the review queue.
 *
 * The open piece keeps its place even once it no longer belongs: an edit that
 * moves it out of the filter, or a list fetched before it came up for review,
 * would otherwise pull the arrows from under the manager mid-work.
 * @module features/archive/piece-card/pieceSequence
 */

import type { Piece } from "@/shared/types";
import {
  matchesLibraryFilters,
  type CardList,
  type LibraryFilters,
} from "../constants/libraryScope";
import { isAwaitingReview } from "./reviewQueue";

export interface PieceSequence {
  readonly list: CardList;
  /** 1-based. */
  readonly position: number;
  readonly total: number;
  readonly previous: Piece | null;
  readonly next: Piece | null;
}

/**
 * The open piece's place in `list`, or null when it has no neighbour there to
 * step to, or the library has not listed it yet.
 */
export const pieceSequence = (
  pieces: readonly Piece[],
  currentId: string,
  list: CardList,
  filters: LibraryFilters,
): PieceSequence | null => {
  const belongs = (piece: Piece): boolean =>
    list === "review" ? isAwaitingReview(piece) : matchesLibraryFilters(piece, filters);
  const walked = pieces.filter((piece) => String(piece.id) === currentId || belongs(piece));
  const index = walked.findIndex((piece) => String(piece.id) === currentId);
  if (index === -1) return null;
  const previous = walked[index - 1] ?? null;
  const next = walked[index + 1] ?? null;
  if (!previous && !next) return null;
  return { list, position: index + 1, total: walked.length, previous, next };
};
