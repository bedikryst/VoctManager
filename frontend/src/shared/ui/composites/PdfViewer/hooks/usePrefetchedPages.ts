/**
 * @file usePrefetchedPages.ts
 * @description Page-window engine behind instant page turns. Keeps the current
 * page plus both neighbours mounted (invisible) so pdf.js has them rasterized
 * before the reader asks for them, and keeps the LAST fully-rendered page on
 * screen until the target page reports render success — a page turn swaps two
 * ready canvases instead of flashing a loader. Neighbour prefetch is dropped
 * at study zooms, where canvases get large enough to pressure tablet memory.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

interface UsePrefetchedPagesArgs {
  currentPage: number;
  numPages: number | null;
  /** Identity of the loaded document; changing it resets the render ledger. */
  resetKey: string | null;
  /** Mount hidden neighbour pages; disable at high zoom (canvas memory). */
  prefetchNeighbors: boolean;
}

interface PrefetchedPages {
  /** Pages to keep mounted, target-first (pdf.js renders in mount order). */
  pagesToRender: number[];
  /** The page actually shown — lags currentPage until the target has rendered. */
  stablePage: number;
  /** Report a page's canvas as rasterized (react-pdf onRenderSuccess). */
  markRendered: (page: number) => void;
}

export const usePrefetchedPages = ({
  currentPage,
  numPages,
  resetKey,
  prefetchNeighbors,
}: UsePrefetchedPagesArgs): PrefetchedPages => {
  const renderedRef = useRef<Set<number>>(new Set());
  const [stablePage, setStablePage] = useState(currentPage);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  // New document → nothing is rasterized yet.
  useLayoutEffect(() => {
    renderedRef.current = new Set();
    setStablePage(currentPageRef.current);
  }, [resetKey]);

  // Swap before paint when the target is already rasterized — this is the
  // zero-flash path for adjacent (prefetched) page turns.
  useLayoutEffect(() => {
    if (renderedRef.current.has(currentPage)) setStablePage(currentPage);
  }, [currentPage]);

  const markRendered = useCallback((page: number) => {
    renderedRef.current.add(page);
    if (page === currentPageRef.current) setStablePage(page);
  }, []);

  const pagesToRender = useMemo(() => {
    const upperBound = numPages ?? currentPage;
    const pageWindow = prefetchNeighbors
      ? [currentPage, currentPage + 1, currentPage - 1, stablePage]
      : [currentPage, stablePage];
    return [...new Set(pageWindow.filter((page) => page >= 1 && page <= upperBound))];
  }, [currentPage, numPages, prefetchNeighbors, stablePage]);

  return { pagesToRender, stablePage, markRendered };
};
