/**
 * @file markBounds.ts
 * @description How much of the page one marking occupies, in normalized page
 * coordinates — so a card opened about that marking can be placed beside it
 * rather than on top of it — and which markings a hand has picked out: the ones
 * a loop drawn round the music takes, and the one under a tap.
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
  isStamp,
  isStroke,
  type NormPoint,
  type ScoreAnnotation,
} from "../types/annotations.dto";

/** A marking's extent, 0..1 against the page box. */
export interface MarkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * A coordinate as it is stored: on the page, and to five places. A
 * hundred-thousandth of a page is far below a pixel at any zoom, and the digits
 * past it only fatten every payload a stroke or a moved selection sends.
 */
export const pageFraction = (value: number): number =>
  Math.round(Math.min(1, Math.max(0, value)) * 1e5) / 1e5;

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
  if (isStroke(annotation)) return strokeBounds(annotation.payload.paths);
  if (isStamp(annotation) || isComment(annotation)) {
    const { x, y } = annotation.payload;
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  return null;
};

/** The box round several markings; null when none of them has one. */
export const unionBounds = (annotations: readonly ScoreAnnotation[]): MarkBounds | null =>
  annotations.reduce<MarkBounds | null>((union, annotation) => {
    const bounds = markBounds(annotation);
    if (!bounds) return union;
    if (!union) return bounds;
    return {
      minX: Math.min(union.minX, bounds.minX),
      minY: Math.min(union.minY, bounds.minY),
      maxX: Math.max(union.maxX, bounds.maxX),
      maxY: Math.max(union.maxY, bounds.maxY),
    };
  }, null);

/** The middle of a box — where a card about it points. */
export const boundsAnchor = (bounds: MarkBounds): { x: number; y: number } => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});

/**
 * Whether a point lies inside a loop, which closes itself from its last point
 * back to its first. Even-odd, so a loop that crosses itself takes what a reader
 * would call inside it. Affine-invariant, so normalized coordinates answer the
 * same as pixels.
 */
export const pointInLoop = ([x, y]: NormPoint, loop: readonly NormPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i];
    const [xj, yj] = loop[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Whether a loop drawn round the music takes this marking. A placed mark is
 * taken when its anchor is inside. A stroke has no anchor, and a loop drawn by
 * hand round a passage clips the end of a long slur and grazes the line beside
 * it, so a stroke is taken when most of its points are inside.
 */
export const isInLoop = (
  annotation: ScoreAnnotation,
  loop: readonly NormPoint[],
): boolean => {
  if (loop.length < 3) return false;
  if (isStroke(annotation)) {
    let inside = 0;
    let total = 0;
    for (const path of annotation.payload.paths) {
      for (const point of path) {
        total += 1;
        if (pointInLoop(point, loop)) inside += 1;
      }
    }
    return total > 0 && inside * 2 > total;
  }
  if (isStamp(annotation) || isComment(annotation)) {
    return pointInLoop([annotation.payload.x, annotation.payload.y], loop);
  }
  return false;
};

/**
 * How far a point is from a stroke, in pixels of a page `width` × `height`.
 * Measured to the polyline through the stored points; the drawn curve passes
 * through every one of them, so the two differ by less than a tap's wander.
 */
export const distanceToStroke = (
  paths: readonly (readonly NormPoint[])[],
  [px, py]: NormPoint,
  width: number,
  height: number,
): number => {
  const x = px * width;
  const y = py * height;
  let best = Infinity;
  for (const path of paths) {
    for (let i = 0; i < path.length; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[Math.min(i + 1, path.length - 1)];
      const x1 = ax * width;
      const y1 = ay * height;
      const dx = bx * width - x1;
      const dy = by * height - y1;
      const length2 = dx * dx + dy * dy;
      const t =
        length2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length2));
      best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
    }
  }
  return best;
};
