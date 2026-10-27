/**
 * @file swipeTurn.ts
 * @description Which way a finger flicked across the score turns, if it turns
 * at all. The viewer reads its own swipes with it, and an overlay that keeps
 * touches for itself reads the same flick the same way.
 * @module shared/ui/composites/PdfViewer
 */

import { SWIPE_AXIS_RATIO, SWIPE_MAX_DURATION_MS, SWIPE_MIN_DISTANCE_PX } from "./constants";
import type { TapZone } from "./tapZone";

/**
 * 1 for a quick horizontal flick of a finger to the left (forward), -1 to the
 * right (back), 0 for anything else — a mouse drag, a slow slide, a stroke
 * that is more vertical than across.
 */
export const resolveSwipeTurn = (
  pointerType: string,
  dx: number,
  dy: number,
  elapsedMs: number,
): TapZone => {
  if (pointerType !== "touch" || elapsedMs > SWIPE_MAX_DURATION_MS) return 0;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return 0;
  if (Math.abs(dx) < SWIPE_AXIS_RATIO * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
};
