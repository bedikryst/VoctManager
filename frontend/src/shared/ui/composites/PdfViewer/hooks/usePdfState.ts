import { useState, useMemo, useEffect, useRef } from "react";
import {
  DEFAULT_ZOOM,
  COMPACT_VIEWPORT_THRESHOLD,
  MOBILE_MIN_PAGE_WIDTH,
  DESKTOP_MIN_PAGE_WIDTH,
  DESKTOP_PAGE_WIDTH_CAP,
} from "../constants";

export const usePdfState = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);

  const isCompactViewport = viewportWidth > 0 && viewportWidth < COMPACT_VIEWPORT_THRESHOLD;

  const renderedPageWidth = useMemo(() => {
    if (viewportWidth <= 0) return undefined;
    const horizontalPadding = isCompactViewport ? 24 : 72;
    const availableWidth = Math.max(0, viewportWidth - horizontalPadding);
    const targetWidth = isCompactViewport
      ? availableWidth
      : Math.min(availableWidth, DESKTOP_PAGE_WIDTH_CAP);
    return Math.max(
      isCompactViewport ? MOBILE_MIN_PAGE_WIDTH : DESKTOP_MIN_PAGE_WIDTH,
      Math.floor(targetWidth)
    );
  }, [isCompactViewport, viewportWidth]);

  const devicePixelRatio = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, 2);
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    const element = viewportRef.current;
    
    const updateViewportWidth = () => setViewportWidth(element.clientWidth);
    updateViewportWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportWidth);
      return () => window.removeEventListener("resize", updateViewportWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setViewportWidth(entry?.contentRect.width ?? element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
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
    devicePixelRatio
  };
};
