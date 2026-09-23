/**
 * @file fit.ts
 * @description How large a page is drawn, as arithmetic on the measured box.
 *
 * Pure and separate from the hook that owns it, because the claim this module
 * makes — "a portrait page fitted to a landscape screen uses barely a third of
 * the width" — is a number, and a number can be checked without a browser.
 * `zoom` is NOT part of it: the fit is the base width, zoom multiplies it.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import {
  COMPACT_VIEWPORT_THRESHOLD,
  MOBILE_MIN_PAGE_WIDTH,
  DESKTOP_MIN_PAGE_WIDTH,
  DESKTOP_PAGE_WIDTH_CAP,
  FIT_VERTICAL_RESERVE_MOBILE,
  FIT_VERTICAL_RESERVE_DESKTOP,
  FIT_VERTICAL_RESERVE_IMMERSIVE,
  PARTIAL_PAGE_FRACTION,
  AUTO_PARTIAL_GAIN_RATIO,
} from "./constants";
import type { FitMode, ResolvedFitMode } from "./types";

export interface PageFitInput {
  viewportWidth: number;
  viewportHeight: number;
  /** Page height / width — A4 portrait is 1.414. */
  pageAspect: number;
  /** Performance mode: no floating chrome, so no inset and no comfort cap. */
  immersive: boolean;
  fitMode: FitMode;
}

export interface PageFitResult {
  /** Base width in CSS px; undefined until the viewport has been measured. */
  renderedPageWidth: number | undefined;
  resolvedFit: ResolvedFitMode;
  /**
   * CSS px the page may run past the box on purpose: outside performance mode
   * the whole-page fit lets the foot of the page slide under the floating nav
   * rather than shrink the music for a strip that carries none. That overrun
   * is chrome, not the rest of the page, so a turn never scrolls through it.
   */
  overflowAllowance: number;
}

export const resolvePageFit = ({
  viewportWidth,
  viewportHeight,
  pageAspect,
  immersive,
  fitMode,
}: PageFitInput): PageFitResult => {
  if (viewportWidth <= 0) {
    return {
      renderedPageWidth: undefined,
      resolvedFit: fitMode === "auto" ? "page" : fitMode,
      overflowAllowance: 0,
    };
  }

  const isCompactViewport = viewportWidth < COMPACT_VIEWPORT_THRESHOLD;
  const horizontalPadding = immersive ? 0 : isCompactViewport ? 16 : 72;
  const availableWidth = Math.max(0, viewportWidth - horizontalPadding);
  const fitWidth =
    immersive || isCompactViewport
      ? availableWidth
      : Math.min(availableWidth, DESKTOP_PAGE_WIDTH_CAP);

  const verticalReserve = immersive
    ? FIT_VERTICAL_RESERVE_IMMERSIVE
    : isCompactViewport
      ? FIT_VERTICAL_RESERVE_MOBILE
      : FIT_VERTICAL_RESERVE_DESKTOP;
  const availableHeight = Math.max(0, viewportHeight - verticalReserve);

  /** Widest the page may be while `fraction` of its height still clears the box. */
  const widthFittingHeight = (fraction: number): number => {
    if (availableHeight <= 0 || pageAspect <= 0) return fitWidth;
    return Math.min(fitWidth, availableHeight / (pageAspect * fraction));
  };

  const wholePageWidth = widthFittingHeight(1);
  const partialPageWidth = widthFittingHeight(PARTIAL_PAGE_FRACTION);

  // Auto is arithmetic on the measured box, never a device guess: the partial
  // fit earns its extra turns only where it renders the music meaningfully
  // bigger, which is precisely the landscape case a whole-page fit starves.
  const resolvedFit: ResolvedFitMode =
    fitMode !== "auto"
      ? fitMode
      : partialPageWidth >= wholePageWidth * AUTO_PARTIAL_GAIN_RATIO
        ? "two-thirds"
        : "page";

  const targetWidth =
    resolvedFit === "width"
      ? fitWidth
      : resolvedFit === "two-thirds"
        ? partialPageWidth
        : wholePageWidth;

  return {
    renderedPageWidth: Math.max(
      isCompactViewport ? MOBILE_MIN_PAGE_WIDTH : DESKTOP_MIN_PAGE_WIDTH,
      Math.floor(targetWidth),
    ),
    resolvedFit,
    overflowAllowance: Math.max(0, -verticalReserve),
  };
};
