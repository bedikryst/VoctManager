/**
 * @file usePdfState.ts
 * @description Geometry of the reading surface: viewport measurement, page
 * aspect and the fit maths that decides how large a page is drawn.
 *
 * The rule the rest of the viewer leans on: `renderedPageWidth` is the BASE
 * width for a fit; `zoom` multiplies it. Fitting the whole page to the shorter
 * side — the only behaviour this hook used to have — is correct for an upright
 * tablet and wasteful everywhere else, so the fit is a mode, and `auto` picks
 * it from the measured box rather than from a device guess.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_ZOOM,
  COMPACT_VIEWPORT_THRESHOLD,
  DEFAULT_PAGE_ASPECT,
} from "../constants";
import { resolvePageFit } from "../fit";
import type { FitMode } from "../types";

interface UsePdfStateArgs {
  /**
   * Performance mode: no toolbar, no bottom nav, no dialog chrome. The page
   * then answers to the screen alone — every inset the fit maths keeps for
   * floating controls is dead space, and the comfort cap on width is a cage.
   */
  immersive?: boolean;
  /**
   * Bucket the remembered fit is stored under. The choice describes a reading
   * posture — score on a stand vs. sheet in the hand — so it must not travel
   * between kinds of document (see `PdfViewerProps.fitScope`).
   */
  fitScope?: string;
}

const FIT_STORAGE_PREFIX = "voct.pdf.fit_mode";

const isFitMode = (value: string | null): value is FitMode =>
  value === "auto" || value === "page" || value === "width" || value === "half";

const fitStorageKey = (scope: string): string => `${FIT_STORAGE_PREFIX}:${scope}`;

/** The fit a reader last chose on this device — it describes their eyes, not the document. */
const readStoredFit = (scope: string): FitMode => {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = window.localStorage.getItem(fitStorageKey(scope));
    return isFitMode(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
};

export const usePdfState = ({
  immersive = false,
  fitScope = "document",
}: UsePdfStateArgs = {}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  // Page height / width. Seeded with A4 so the first paint is already near-fit,
  // then corrected from the real page.
  const [pageAspect, setPageAspect] = useState(DEFAULT_PAGE_ASPECT);
  const [fitMode, setFitModeState] = useState<FitMode>(() => readStoredFit(fitScope));

  const setFitMode = useCallback((next: FitMode) => {
    setFitModeState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(fitStorageKey(fitScope), next);
    } catch {
      // Private mode / storage disabled: the choice still holds for the session.
    }
  }, [fitScope]);

  const isCompactViewport = viewportWidth > 0 && viewportWidth < COMPACT_VIEWPORT_THRESHOLD;

  const { renderedPageWidth, resolvedFit } = useMemo(
    () =>
      resolvePageFit({
        viewportWidth,
        viewportHeight,
        pageAspect,
        immersive,
        fitMode,
      }),
    [fitMode, immersive, viewportWidth, viewportHeight, pageAspect],
  );

  const devicePixelRatio = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, 2);
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    const element = viewportRef.current;

    const updateViewportSize = () => {
      setViewportWidth(element.clientWidth);
      setViewportHeight(element.clientHeight);
    };
    updateViewportSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportSize);
      return () => window.removeEventListener("resize", updateViewportSize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setViewportWidth(entry?.contentRect.width ?? element.clientWidth);
      setViewportHeight(entry?.contentRect.height ?? element.clientHeight);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fed from the rendered page's intrinsic dimensions; ignores noise so an
  // identical aspect never churns the layout.
  const reportPageAspect = useCallback((aspect: number) => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    setPageAspect((current) =>
      Math.abs(current - aspect) < 0.001 ? current : aspect,
    );
  }, []);

  return {
    viewportRef,
    numPages,
    setNumPages,
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    fitMode,
    setFitMode,
    resolvedFit,
    renderedPageWidth,
    isCompactViewport,
    devicePixelRatio,
    reportPageAspect,
  };
};
