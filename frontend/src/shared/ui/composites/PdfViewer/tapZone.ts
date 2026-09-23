/**
 * @file tapZone.ts
 * @description Which way a tap on the score turns, measured against the page
 * the reader sees and never against the screen around it.
 *
 * A screen-relative band only lands on the paper when the page fills the
 * screen. A whole page on a landscape laptop covers the middle 40% of the
 * width, so a screen band leaves a strip of black beside the paper that
 * leaves performance mode instead of turning — the one spot a reader aims
 * at when they mean "next". Here the paper's outer bands turn, everything
 * beside the paper turns, and only the middle of the paper is the exit.
 *
 * `tapZoneBands` is the one geometry both the hit test and the drawn zone
 * hints read, so what the reader is shown and what a tap does cannot drift.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { TAP_ZONE_FRACTION } from "./constants";

/** -1 turns back, 1 turns forward, 0 is the centre tap. */
export type TapZone = -1 | 0 | 1;

type HorizontalExtent = Pick<DOMRect, "left" | "right">;

/** The two turn bands on the visible page, in client px. */
export interface TapZoneBands {
  back: HorizontalExtent;
  forward: HorizontalExtent;
}

export const tapZoneBands = (
  viewport: HorizontalExtent,
  page: HorizontalExtent | null,
): TapZoneBands => {
  // A zoomed page overflows the screen; its visible part is what the reader
  // aims at, so the bands sit on the screen edges again.
  const left = page ? Math.max(page.left, viewport.left) : viewport.left;
  const right = page ? Math.min(page.right, viewport.right) : viewport.right;
  const [from, to] = right > left ? [left, right] : [viewport.left, viewport.right];
  const band = Math.max(to - from, 1) * TAP_ZONE_FRACTION;
  return {
    back: { left: from, right: from + band },
    forward: { left: to - band, right: to },
  };
};

export const resolveTapZone = (
  clientX: number,
  viewport: HorizontalExtent,
  page: HorizontalExtent | null,
): TapZone => {
  const { back, forward } = tapZoneBands(viewport, page);
  // Beside the paper counts as the band next to it: only the middle of the
  // paper is the exit.
  if (clientX <= back.right) return -1;
  if (clientX >= forward.left) return 1;
  return 0;
};
