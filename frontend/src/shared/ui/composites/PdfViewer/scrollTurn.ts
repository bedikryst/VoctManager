/**
 * @file scrollTurn.ts
 * @description How far one reader's turn scrolls a page taller than the screen,
 * and which overrun does not count, because the fit put it under the nav.
 *
 * A rest of the page that fits one screen is shown in one turn, and a longer
 * rest is split into equal turns. A fixed screen-minus-overlap step would end
 * on a sliver: a page exactly two screens tall would take a third tap that
 * moves it by the overlap alone. Pure, so the stop count per page — the thing a
 * singer counts in taps — is checked without a browser.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { FIT_SCROLL_OVERLAP_PX, SCROLL_EDGE_TOLERANCE_PX } from "./constants";

/**
 * The part of the scroll range a reader pages through. A page that overruns the
 * box by no more than the fit's `overflowAllowance` reads as whole — its foot
 * sits under the floating nav by design — so a turn goes straight to the next
 * page and a turn back lands on the top edge, not a few pixels down.
 */
export const readableScrollRange = (maxScroll: number, overflowAllowance: number): number =>
  maxScroll > overflowAllowance + SCROLL_EDGE_TOLERANCE_PX ? maxScroll : 0;

/**
 * Scroll distance (CSS px, always positive) of the next turn toward the edge
 * `remaining` px away, or 0 when the viewport is already parked at that edge
 * and the turn belongs to the next page.
 */
export const planScrollTurn = (remaining: number, clientHeight: number): number => {
  if (remaining <= SCROLL_EDGE_TOLERANCE_PX) return 0;
  if (remaining <= clientHeight) return remaining;
  const step = Math.max(clientHeight - FIT_SCROLL_OVERLAP_PX, 1);
  return remaining / Math.ceil(remaining / step);
};
