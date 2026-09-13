/**
 * @file markBounds.ts
 * @description How much of the page one marking occupies, in normalized page
 * coordinates — so a card opened about that marking can be placed beside it
 * rather than on top of it.
 *
 * A note and a stamp are anchored points and answer this trivially. A stroke
 * does not: it is a run of coordinates with no centre of its own, and the only
 * honest anchor is the middle of what it covers. Without that, a card about a
 * crescendo hairpin drawn across half a system would open at the hairpin's
 * first point and sit over the rest of it.
 * @module features/annotations/lib
 */

import {
  isComment,
  isFreehand,
  isHighlight,
  isStamp,
  type CommentPayload,
  type NormPoint,
  type ScoreAnnotation,
  type StampPayload,
} from "../types/annotations.dto";

/** A marking's extent, 0..1 against the page box. */
export interface MarkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Smallest box containing every point of every stroke; null if there are none. */
export const strokeBounds = (
  paths: readonly (readonly NormPoint[])[],
): MarkBounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    for (const [x, y] of path) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
};

/**
 * The box one marking occupies. A point mark reports a zero-size box at its
 * anchor — the caller adds whatever the glyph itself reaches, which only the
 * caller knows (a pin hangs below its point; inline words are centred on it).
 */
export const markBounds = (annotation: ScoreAnnotation): MarkBounds | null => {
  if (isFreehand(annotation) || isHighlight(annotation)) {
    return strokeBounds(annotation.payload.paths);
  }
  if (isStamp(annotation) || isComment(annotation)) {
    const { x, y } = annotation.payload as StampPayload | CommentPayload;
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  return null;
};

/** The middle of a box — where a card about it points. */
export const boundsAnchor = (bounds: MarkBounds): { x: number; y: number } => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});
