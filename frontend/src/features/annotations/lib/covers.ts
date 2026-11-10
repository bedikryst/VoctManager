/**
 * @file covers.ts
 * @description Geometry for the cover ("Korektor"): a rectangle of paper drawn
 * corner to corner over a printed sign, so the conductor can replace it with
 * his own cleanly. It is picked from the shape picker because it is drawn by
 * the same drag, but it lands as a mark of its own kind (`CV`), never as ink.
 *
 * A cover lies under every other mark, so it comes last in every contest: a
 * tap takes any mark above it first, and the eraser passes over it, or rubbing
 * out the "p" written over a cover would bring the printed "mf" back. The rules
 * that need a cover's box read it from here.
 * @module features/annotations/lib
 */

import type { CoverPayload, NormPoint } from "../types/annotations.dto";
import { pageFraction } from "./markBounds";
import { defaultInk } from "./palette";
import type { ShapeKind } from "./shapes";

/** The shape picker's entry that draws a cover rather than ink. */
export const COVER_SHAPE: ShapeKind = "cover";

/**
 * What a cover is written in. Its colour is not the writer's to choose: the
 * server stores the unreserved pencil (`DEFAULT_INK`) whatever arrives, so the
 * editor sends that and nothing waits on a correction.
 */
export const COVER_INK: string = defaultInk(false);

/** A drag shorter than this (px) is a tap, and a tap covers nothing. */
const COVER_MIN_DRAG_PX = 5;
/**
 * A cover's narrowest side, in screen pixels. A drag along a staff line would
 * otherwise make a box with no height, which nothing can see or tap; a dot of
 * staccato is about this size.
 */
const COVER_MIN_SIDE_PX = 4;

/** A cover's box in page pixels. */
export interface CoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The cover one drag from `from` to `to` makes on a page `width` × `height`
 * px: the box between the two corners, held on the page and never thinner
 * than a sliver. Null for a drag too short to mean anything.
 */
export const coverFromDrag = (
  from: NormPoint,
  to: NormPoint,
  width: number,
  height: number,
): CoverPayload | null => {
  if (width <= 0 || height <= 0) return null;
  const dxPx = (to[0] - from[0]) * width;
  const dyPx = (to[1] - from[1]) * height;
  if (Math.hypot(dxPx, dyPx) < COVER_MIN_DRAG_PX) return null;
  const grow = (lo: number, hi: number, side: number): [number, number] => {
    const min = COVER_MIN_SIDE_PX / side;
    if (hi - lo >= min) return [lo, hi];
    const mid = (lo + hi) / 2;
    const start = Math.min(1 - min, Math.max(0, mid - min / 2));
    return [start, start + min];
  };
  const [x0, x1] = grow(Math.min(from[0], to[0]), Math.max(from[0], to[0]), width);
  const [y0, y1] = grow(Math.min(from[1], to[1]), Math.max(from[1], to[1]), height);
  const x = pageFraction(x0);
  const y = pageFraction(y0);
  return {
    x,
    y,
    w: pageFraction(Math.min(x1, 1) - x),
    h: pageFraction(Math.min(y1, 1) - y),
  };
};

/** Where a cover sits on a page `width` × `height` px. */
export const coverRect = (
  { x, y, w, h }: CoverPayload,
  width: number,
  height: number,
): CoverRect => ({ left: x * width, top: y * height, width: w * width, height: h * height });

/** Whether a point (0..1) falls on the cover's paper. */
export const isOnCover = ({ x, y, w, h }: CoverPayload, [px, py]: NormPoint): boolean =>
  px >= x && px <= x + w && py >= y && py <= y + h;
