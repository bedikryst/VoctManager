import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_ZOOM,
  COMPACT_VIEWPORT_THRESHOLD,
  MOBILE_MIN_PAGE_WIDTH,
  DESKTOP_MIN_PAGE_WIDTH,
  DESKTOP_PAGE_WIDTH_CAP,
  DEFAULT_PAGE_ASPECT,
  FIT_VERTICAL_RESERVE_MOBILE,
  FIT_VERTICAL_RESERVE_DESKTOP,
} from "../constants";

export const usePdfState = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  // Page height / width, so zoom = 1 shows the WHOLE page (a score on a stand),
  // not a width-filled slice you have to scroll. Seeded with A4 so the first
  // paint is already near-fit, then corrected from the real page.
  const [pageAspect, setPageAspect] = useState(DEFAULT_PAGE_ASPECT);

  const isCompactViewport = viewportWidth > 0 && viewportWidth < COMPACT_VIEWPORT_THRESHOLD;

  const renderedPageWidth = useMemo(() => {
    if (viewportWidth <= 0) return undefined;
    const horizontalPadding = isCompactViewport ? 16 : 72;
    const availableWidth = Math.max(0, viewportWidth - horizontalPadding);
    const fitWidth = isCompactViewport
      ? availableWidth
      : Math.min(availableWidth, DESKTOP_PAGE_WIDTH_CAP);
    // Also cap by the width whose full page height clears the viewport (minus
    // floating chrome) — so at zoom 1 the entire page is on screen at once.
    let targetWidth = fitWidth;
    if (viewportHeight > 0 && pageAspect > 0) {
      const verticalReserve = isCompactViewport
        ? FIT_VERTICAL_RESERVE_MOBILE
        : FIT_VERTICAL_RESERVE_DESKTOP;
      const availableHeight = Math.max(0, viewportHeight - verticalReserve);
      targetWidth = Math.min(fitWidth, availableHeight / pageAspect);
    }
    return Math.max(
      isCompactViewport ? MOBILE_MIN_PAGE_WIDTH : DESKTOP_MIN_PAGE_WIDTH,
      Math.floor(targetWidth)
    );
  }, [isCompactViewport, viewportWidth, viewportHeight, pageAspect]);

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
    renderedPageWidth,
    isCompactViewport,
    devicePixelRatio,
    reportPageAspect,
  };
};
