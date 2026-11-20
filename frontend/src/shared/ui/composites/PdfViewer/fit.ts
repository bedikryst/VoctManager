/**
 * @file fit.ts
 * @description How large a page is drawn, as arithmetic on the measured box.
 *
 * Pure and separate from the hook that owns it, because the claim this module
 * makes — "a portrait page fitted to a landscape screen uses barely a third of
 * the width" — is a number, and a number can be checked without a browser.
 * `zoom` is NOT part of it: the fit is the base width, zoom multiplies it.
 * @module shared/ui/composites/PdfViewer
 */

import {
  BAND_HEIGHT_PX,
  COMPACT_VIEWPORT_THRESHOLD,
  MOBILE_MIN_PAGE_WIDTH,
  DESKTOP_MIN_PAGE_WIDTH,
  DESKTOP_PAGE_WIDTH_CAP,
  FIT_HORIZONTAL_RESERVE_MOBILE,
  FIT_HORIZONTAL_RESERVE_DESKTOP,
  FIT_VERTICAL_RESERVE_MOBILE,
  FIT_VERTICAL_RESERVE_DESKTOP,
  FIT_VERTICAL_RESERVE_IMMERSIVE,
  PARTIAL_PAGE_FRACTION,
  AUTO_PARTIAL_GAIN_RATIO,
  DESK_HORIZONTAL_RESERVE,
  DESK_MIN_PAGE_WIDTH,
  DESK_VERTICAL_RESERVE,
} from "./constants";
import type { FitMode, ResolvedFitMode } from "./types";

export interface PageFitInput {
  viewportWidth: number;
  viewportHeight: number;
  /** Page height / width — A4 portrait is 1.414. */
  pageAspect: number;
  /** Performance mode: no bands, so no inset and no comfort cap. */
  immersive: boolean;
  fitMode: FitMode;
  /** Desk fits measure the scroll box before padding and use one set of margins. */
  desk?: "fitted" | "wide";
}

export interface PageFitResult {
  /** Base width in CSS px; undefined until the viewport has been measured. */
  renderedPageWidth: number | undefined;
  resolvedFit: ResolvedFitMode;
}

export const resolvePageFit = ({
  viewportWidth,
  viewportHeight,
  pageAspect,
  immersive,
  fitMode,
  desk,
}: PageFitInput): PageFitResult => {
  if (viewportWidth <= 0) {
    return {
      renderedPageWidth: undefined,
      resolvedFit: fitMode === "auto" ? "page" : fitMode,
    };
  }

  if (desk && !immersive) {
    const fitWidth = Math.max(0, viewportWidth - DESK_HORIZONTAL_RESERVE);
    const fitHeight = Math.max(0, viewportHeight - DESK_VERTICAL_RESERVE);
    const pageWidth = deskPageWidth(fitHeight, pageAspect);
    const autoWidth = desk === "wide" ? fitWidth : Math.max(pageWidth, DESK_MIN_PAGE_WIDTH);
    const resolvedFit = fitMode === "auto"
      ? Math.min(fitWidth, autoWidth) > pageWidth ? "width" : "page"
      : fitMode;
    const targetWidth = fitMode === "auto" ? autoWidth : {
      page: pageWidth,
      width: fitWidth,
      "two-thirds": pageWidth / PARTIAL_PAGE_FRACTION,
    }[resolvedFit];
    return { renderedPageWidth: Math.floor(Math.min(fitWidth, targetWidth)), resolvedFit };
  }

  const isCompactViewport = viewportWidth < COMPACT_VIEWPORT_THRESHOLD;
  const horizontalPadding = immersive
    ? 0
    : isCompactViewport
      ? FIT_HORIZONTAL_RESERVE_MOBILE
      : FIT_HORIZONTAL_RESERVE_DESKTOP;
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
  };
};

interface ViewerWidthInput {
  /** The viewer's whole height, both bands included. */
  viewerHeight: number;
  /** Page height / width. */
  pageAspect: number;
}

const deskPageWidth = (height: number, aspect: number): number =>
  aspect > 0 ? height / aspect : 0;

/** Width needed by a fitted desk, including both side margins. */
export const viewerWidthForPage = ({ viewerHeight, pageAspect }: ViewerWidthInput): number =>
  Math.max(DESK_MIN_PAGE_WIDTH, Math.floor(deskPageWidth(
    Math.max(0, viewerHeight - 2 * BAND_HEIGHT_PX - DESK_VERTICAL_RESERVE),
    pageAspect,
  ))) + DESK_HORIZONTAL_RESERVE;
