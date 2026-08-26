/**
 * @file PdfViewer.tsx
 * @description Headless, gated PDF reading instrument. Renders a prefetched
 * page window (current ± neighbours) so page turns swap two ready canvases
 * instead of flashing a loader; adds edge-tap/swipe/pedal-key navigation,
 * pinch and ctrl+wheel zoom with a live CSS preview, a screen wake lock and an
 * immersive performance mode (fullscreen, chrome hidden, page filling the
 * screen edge to edge). Annotation features mount through the toolbarSlot /
 * renderPageOverlay / overlaySlot seams.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { FileWarning } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { useWakeLock } from "@/shared/lib/hardware/useWakeLock";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";

import { PdfViewerProps, PdfViewerEvent, LoadErrorReason } from "./types";
import {
  ZOOM_STEP,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  SWIPE_EDGE_TOLERANCE_PX,
  PREFETCH_MAX_ZOOM,
  FIT_SCROLL_OVERLAP_PX,
  SCROLL_EDGE_TOLERANCE_PX,
} from "./constants";
import { clampValue, buildPdfFileName, classifyLoadError, createDownloadAnchor } from "./utils";
import { PdfToolbar } from "./components/PdfToolbar";
import { PdfBottomNav } from "./components/PdfBottomNav";
import { PdfOutlineDrawer } from "./components/PdfOutlineDrawer";
import { usePdfState } from "./hooks/usePdfState";
import { usePdfOutline, type OutlineCapableDocument } from "./hooks/usePdfOutline";
import { usePrefetchedPages } from "./hooks/usePrefetchedPages";
import { useImmersiveMode } from "./hooks/useImmersiveMode";
import { useViewerGestures } from "./hooks/useViewerGestures";
import { PdfImmersiveProvider } from "./context";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const CHIP_HINT_DURATION_MS = 3200;
const CHIP_PAGE_DURATION_MS = 1200;

/**
 * Where the page about to be shown must be parked. `bottom` is what turning
 * BACK through a page too tall for one screen needs, or the reader arrives at
 * music they have already sung; `focus` is a jump to a known spot on the page
 * (a marking), which would otherwise land above the thing it was aimed at.
 */
type PendingPark = { mode: "top" } | { mode: "bottom" } | { mode: "focus"; y: number };

export const PdfViewer = ({
  fetchBlob,
  docKey,
  volatile: isVolatile = false,
  title,
  subtitle,
  fileName,
  onEvent,
  toolbarSlot,
  renderPageOverlay,
  overlaySlot,
  onPageApiChange,
  reserveTopRight = false,
  canExport = true,
  fitScope,
  className,
}: PdfViewerProps): React.JSX.Element => {
  const { t } = useTranslation();

  const rootRef = useRef<HTMLDivElement | null>(null);

  const emitEvent = useCallback(
    (event: PdfViewerEvent) => onEvent?.(event),
    [onEvent],
  );

  const handleImmersiveChange = useCallback((active: boolean) => {
    emitEvent({ type: "immersive_change", active });
  }, [emitEvent]);

  // Resolved before the page geometry, because performance mode changes what
  // "fit the page" means — no chrome to clear, no comfort cap on width.
  const { isImmersive, enter: enterImmersive, exit: exitImmersive } =
    useImmersiveMode(rootRef, handleImmersiveChange);

  const {
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
  } = usePdfState({ immersive: isImmersive, fitScope });

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Live rendered-page box (CSS px), measured for the overlay seam. Observed via
  // ResizeObserver so it stays correct across zoom, page change and reflow.
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const [pageBox, setPageBox] = useState<{ width: number; height: number } | null>(null);

  // Transient feedback chip (immersive hint / page position in immersive).
  const [chip, setChip] = useState<{ id: number; text: string } | null>(null);
  const chipTimerRef = useRef<number | null>(null);

  const {
    data: documentBlob,
    isPending: isFetchingBlob,
    isError: isFetchError,
    error: fetchError,
    refetch: retryFetch,
  } = useQuery({
    queryKey: ["pdf", docKey],
    queryFn: async () => {
      if (!fetchBlob) throw new Error("No fetchBlob provided");
      return await fetchBlob();
    },
    enabled: !!fetchBlob && !!docKey,
    staleTime: isVolatile ? 0 : Infinity,
    refetchOnMount: isVolatile ? "always" : true,
    // Never on focus: the blob is megabytes and alt-tabbing is not a request
    // for a fresh render.
    refetchOnWindowFocus: false,
  });

  const resolvedFileName = useMemo(
    () => buildPdfFileName(title, fileName),
    [fileName, title],
  );

  const supportsNativeShare = useMemo(() => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof File === "undefined") return false;
    try {
      if (typeof navigator.canShare !== "function") return true;
      return navigator.canShare({
        files: [new File([""], resolvedFileName, { type: "application/pdf" })],
      });
    } catch {
      return false;
    }
  }, [resolvedFileName]);

  const resolveViewerErrorMessage = useCallback((reason: LoadErrorReason): string => {
    return reason === "permission_denied"
      ? t("pdf_viewer.error_403", "You do not have permission to view this document.")
      : t("pdf_viewer.error_generic", "The document could not be loaded.");
  }, [t]);

  const flagViewerError = useCallback((error: unknown) => {
    const reason = classifyLoadError(error);
    const message = error instanceof Error ? error.message : undefined;
    emitEvent({ type: "load_error", reason, message });
  }, [emitEvent]);

  const pendingParkRef = useRef<PendingPark>({ mode: "top" });

  /** Consume the parking instruction against the page that is on screen NOW. */
  const parkViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const park = pendingParkRef.current;
    pendingParkRef.current = { mode: "top" };
    const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 0);
    let top = 0;
    if (park.mode === "bottom") {
      top = maxScroll;
    } else if (park.mode === "focus") {
      const page = pageBoxRef.current?.getBoundingClientRect();
      const frame = viewport.getBoundingClientRect();
      const pageTop = page ? viewport.scrollTop + page.top - frame.top : 0;
      const centred = pageTop + park.y * (page?.height ?? 0) - viewport.clientHeight / 2;
      top = clampValue(centred, 0, maxScroll);
    }
    viewport.scrollTo({ top, left: 0 });
  }, [viewportRef]);

  const changePage = useCallback((nextPage: number, focusY?: number) => {
    if (!numPages) return;
    const clamped = clampValue(nextPage, 1, numPages);
    if (focusY !== undefined) pendingParkRef.current = { mode: "focus", y: focusY };
    if (currentPage !== clamped) {
      emitEvent({ type: "page_change", from: currentPage, to: clamped });
      setCurrentPage(clamped);
      return;
    }
    // Already here: no render will follow to consume the instruction, but a
    // mark halfway down a page taller than the screen still has to be brought
    // into view.
    if (focusY !== undefined) parkViewport();
  }, [emitEvent, numPages, currentPage, setCurrentPage, parkViewport]);

  /**
   * A reader's turn — which is not always a page. Whether a screenful or a page
   * is the unit is MEASURED, never inferred from the fit: a whole-page fit
   * overflows too, once the reader zooms or where the minimum page width
   * outgrows a short box, and turning past the rest of the page there would
   * turn past music.
   */
  const turnPage = useCallback((delta: 1 | -1) => {
    const viewport = viewportRef.current;
    if (viewport) {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const canScroll =
        delta === 1
          ? viewport.scrollTop < maxScroll - SCROLL_EDGE_TOLERANCE_PX
          : viewport.scrollTop > SCROLL_EDGE_TOLERANCE_PX;
      if (canScroll) {
        const step = Math.max(viewport.clientHeight - FIT_SCROLL_OVERLAP_PX, 1);
        viewport.scrollTo({
          top: viewport.scrollTop + delta * step,
          left: viewport.scrollLeft,
        });
        return;
      }
    }
    // Only a turn that lands somewhere may leave a parking instruction behind —
    // otherwise a refused turn at the last page would silently steer the NEXT
    // navigation (an outline jump, a page typed in) to the wrong edge.
    const target = currentPage + delta;
    if (numPages === null || target < 1 || target > numPages) return;
    pendingParkRef.current = { mode: delta === 1 ? "top" : "bottom" };
    changePage(target);
  }, [changePage, currentPage, numPages, viewportRef]);

  const changeZoom = useCallback((delta: number) => {
    const next = clampValue(Number((zoom + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    if (next !== zoom) {
      emitEvent({ type: "zoom_change", from: zoom, to: next });
      startTransition(() => setZoom(next));
    }
  }, [emitEvent, zoom, setZoom]);

  const resetZoom = useCallback(() => {
    if (zoom !== DEFAULT_ZOOM) {
      emitEvent({ type: "zoom_change", from: zoom, to: DEFAULT_ZOOM });
      startTransition(() => setZoom(DEFAULT_ZOOM));
    }
  }, [emitEvent, zoom, setZoom]);

  const handleRetry = useCallback(() => {
    emitEvent({ type: "retry" });
    retryFetch();
  }, [emitEvent, retryFetch]);

  // Outline (PDF bookmarks) → in-viewer "jump to piece" navigation.
  const { outline, loadOutline } = usePdfOutline(blobUrl);

  const handleDocumentLoadSuccess = useCallback((pdf: OutlineCapableDocument) => {
    const totalPages = pdf.numPages;
    setNumPages(totalPages);
    startTransition(() => setCurrentPage((page) => clampValue(page, 1, totalPages)));
    emitEvent({ type: "load_success", numPages: totalPages });
    loadOutline(pdf);
  }, [emitEvent, loadOutline, setCurrentPage, setNumPages]);

  const handleOpenInBrowser = useCallback(() => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    emitEvent({ type: "open_in_browser" });
  }, [blobUrl, emitEvent]);

  const handleDownload = useCallback(async () => {
    if (isDownloading || !documentBlob) return;
    setIsDownloading(true);
    try {
      createDownloadAnchor(documentBlob, resolvedFileName);
      emitEvent({ type: "download", fileName: resolvedFileName, succeeded: true });
    } catch (error) {
      flagViewerError(error);
      emitEvent({ type: "download", fileName: resolvedFileName, succeeded: false });
    } finally {
      setIsDownloading(false);
    }
  }, [documentBlob, emitEvent, flagViewerError, isDownloading, resolvedFileName]);

  const handleShare = useCallback(async () => {
    if (!supportsNativeShare || isSharing || !documentBlob) return;
    setIsSharing(true);
    let succeeded = false;
    let cancelled = false;
    try {
      const shareFile = new File([documentBlob], resolvedFileName, {
        type: documentBlob.type || "application/pdf",
      });
      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [shareFile] })) {
        await handleDownload();
        return;
      }
      await navigator.share({ files: [shareFile], title, text: subtitle });
      succeeded = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") cancelled = true;
      else flagViewerError(error);
    } finally {
      setIsSharing(false);
      emitEvent({ type: "share", fileName: resolvedFileName, succeeded, cancelled });
    }
  }, [documentBlob, emitEvent, flagViewerError, handleDownload, isSharing, resolvedFileName, subtitle, supportsNativeShare, title]);

  const showChip = useCallback((text: string, durationMs: number) => {
    setChip({ id: Date.now(), text });
    if (chipTimerRef.current) window.clearTimeout(chipTimerRef.current);
    chipTimerRef.current = window.setTimeout(() => setChip(null), durationMs);
  }, []);

  useEffect(() => () => {
    if (chipTimerRef.current) window.clearTimeout(chipTimerRef.current);
  }, []);

  const handleEnterImmersive = useCallback(() => {
    enterImmersive();
    showChip(
      t("pdf_viewer.immersive_hint", "Edges turn pages · centre exits"),
      CHIP_HINT_DURATION_MS,
    );
  }, [enterImmersive, showChip, t]);

  const isIdle = !fetchBlob;
  const showLoadingState = (isIdle && !blobUrl) || (!isIdle && isFetchingBlob && !blobUrl);
  const showPdfChrome = !!blobUrl && numPages !== null && !isFetchError;
  const errorReason = isFetchError ? classifyLoadError(fetchError) : null;
  const errorMessage = errorReason ? resolveViewerErrorMessage(errorReason) : null;

  // An open score on a stand must never sleep mid-rehearsal.
  useWakeLock(!!blobUrl && !isFetchError);

  const { pagesToRender, stablePage, markRendered } = usePrefetchedPages({
    currentPage,
    numPages,
    resetKey: blobUrl,
    prefetchNeighbors: zoom <= PREFETCH_MAX_ZOOM,
  });

  // A turned page opens at its top edge, like turning paper — unless the turn
  // that brought us here asked for somewhere else.
  useEffect(() => {
    parkViewport();
  }, [stablePage, parkViewport]);

  // A new fit is a new statement of how big the music should be, so it becomes
  // the baseline: a zoom calibrated for the old fit (or the other orientation)
  // would leave the page hanging off the side of the screen, and a kept scroll
  // offset would open the score mid-stave. Guarded on an actual change — the
  // setter is stable, but reacting to `zoom` here would undo every zoom.
  const previousFitRef = useRef(resolvedFit);
  const previousImmersiveRef = useRef(isImmersive);
  useEffect(() => {
    const fitChanged = previousFitRef.current !== resolvedFit;
    const immersiveChanged = previousImmersiveRef.current !== isImmersive;
    previousFitRef.current = resolvedFit;
    previousImmersiveRef.current = isImmersive;
    // Performance mode re-fits by itself — no chrome to clear, no comfort cap —
    // so an `auto` that tips page↔half on the way in or out is a side effect of
    // pressing a button, not a new statement about size. Wiping a magnification
    // the singer set for this stand, mid-concert, on a stray centre tap, is not
    // something to do to them.
    if (!fitChanged || immersiveChanged) return;
    setZoom(DEFAULT_ZOOM);
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [resolvedFit, isImmersive, setZoom, viewportRef]);

  // Page-position feedback while chrome is hidden.
  const immersiveRef = useRef(isImmersive);
  immersiveRef.current = isImmersive;
  const numPagesRef = useRef(numPages);
  numPagesRef.current = numPages;
  useEffect(() => {
    if (!immersiveRef.current || !numPagesRef.current) return;
    showChip(`${stablePage} / ${numPagesRef.current}`, CHIP_PAGE_DURATION_MS);
  }, [stablePage, showChip]);

  const handlePageDelta = useCallback((delta: 1 | -1) => {
    turnPage(delta);
  }, [turnPage]);

  const handleCenterTap = useCallback(() => {
    if (isImmersive) exitImmersive();
  }, [exitImmersive, isImmersive]);

  // Gesture-zoom commit: flushSync so the layout is at the real zoom before the
  // caller clears its CSS preview transform — one paint, no snap-back. Scroll is
  // adjusted so the gesture's focal point stays put.
  const handleZoomTo = useCallback((nextZoom: number, focal: { x: number; y: number }) => {
    const next = clampValue(Number(nextZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    const prev = zoomRef.current;
    if (next === prev) return;
    emitEvent({ type: "zoom_change", from: prev, to: next });
    flushSync(() => setZoom(next));
    const viewport = viewportRef.current;
    if (viewport) {
      const ratio = next / prev;
      viewport.scrollLeft = (viewport.scrollLeft + focal.x) * ratio - focal.x;
      viewport.scrollTop = (viewport.scrollTop + focal.y) * ratio - focal.y;
    }
  }, [emitEvent, setZoom, viewportRef]);

  // Does the page ACTUALLY overflow? Measured, not inferred from the zoom
  // number or the fit: a portrait page zoomed on a landscape screen still fits
  // sideways, and handing the browser `pan-x` there would eat the swipe that
  // turns the page. The vertical edges ride along because the page controls
  // must not read "last page, nothing further" while half a page is still
  // below the fold. Observed on both boxes, because the canvas settles at its
  // new size a beat after the zoom state changes.
  const [isPannableX, setIsPannableX] = useState(false);
  const [scrollEdges, setScrollEdges] = useState({ atTop: true, atBottom: true });
  useEffect(() => {
    const viewport = viewportRef.current;
    const page = pageBoxRef.current;
    if (!viewport) return;
    const measure = () => {
      setIsPannableX(
        viewport.scrollWidth - viewport.clientWidth > SWIPE_EDGE_TOLERANCE_PX,
      );
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const next = {
        atTop: viewport.scrollTop <= SCROLL_EDGE_TOLERANCE_PX,
        atBottom: viewport.scrollTop >= maxScroll - SCROLL_EDGE_TOLERANCE_PX,
      };
      setScrollEdges((current) =>
        current.atTop === next.atTop && current.atBottom === next.atBottom
          ? current
          : next,
      );
    };
    measure();
    viewport.addEventListener("scroll", measure, { passive: true });
    if (!page || typeof ResizeObserver === "undefined") {
      return () => viewport.removeEventListener("scroll", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    observer.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [viewportRef, blobUrl, stablePage, renderedPageWidth]);

  // Whether a turn has anywhere to go — a page away OR a screenful away.
  const canTurnBack = currentPage > 1 || !scrollEdges.atTop;
  const canTurnForward =
    (numPages !== null && currentPage < numPages) || !scrollEdges.atBottom;

  useViewerGestures({
    viewportRef,
    pinchTargetRef: pageBoxRef,
    enabled: showPdfChrome,
    zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    onPageDelta: handlePageDelta,
    onCenterTap: handleCenterTap,
    onZoomTo: handleZoomTo,
  });

  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    if (!blobUrl || isFetchError) return;

    if (event.key === "Escape") {
      if (isImmersive) {
        // Capture phase + stopPropagation so Esc leaves immersive without also
        // closing a wrapping Radix dialog.
        event.preventDefault();
        event.stopPropagation();
        exitImmersive();
      }
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target?.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "") ||
      target?.closest?.("[data-radix-popper-content-wrapper]")
    ) {
      return;
    }

    // Plain keys only — ctrl/⌘/alt combos belong to the browser and to
    // feature shortcuts (annotation undo/redo). Shift stays: Shift+Space.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const isSpace = event.key === " ";
    if (isSpace && ["BUTTON", "A"].includes(target?.tagName || "")) return;

    // Prev/next also cover Bluetooth page-turn pedals out of the box — their
    // factory profiles emit arrows, PageUp/PageDown or Space.
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key) || (isSpace && event.shiftKey)) {
      event.preventDefault();
      turnPage(-1);
      return;
    }
    if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key) || (isSpace && !event.shiftKey)) {
      event.preventDefault();
      turnPage(1);
      return;
    }
    if (event.key === "Home") { event.preventDefault(); changePage(1); return; }
    if (event.key === "End" && numPages) { event.preventDefault(); changePage(numPages); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); changeZoom(-ZOOM_STEP); return; }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(ZOOM_STEP); return; }
    if (event.key === "0") { event.preventDefault(); resetZoom(); }
  }, [blobUrl, isFetchError, isImmersive, exitImmersive, changePage, turnPage, numPages, changeZoom, resetZoom]);

  useEffect(() => {
    if (docKey) emitEvent({ type: "open", docKey });
  }, [docKey, emitEvent]);

  // Surface the live page handle so an overlaySlot can drive navigation — and
  // the rendered page width, which is what tells a writing tool whether there
  // is room to write at all.
  useEffect(() => {
    onPageApiChange?.({
      currentPage,
      numPages,
      goToPage: changePage,
      turnPage,
      pageWidth: pageBox?.width ?? null,
    });
  }, [onPageApiChange, currentPage, numPages, changePage, turnPage, pageBox]);

  useEffect(() => {
    // Guard against a non-Blob slipping through (e.g. a persisted cache entry
    // rehydrated as `{}`): createObjectURL throws "Overload resolution failed"
    // on anything that isn't a Blob/MediaSource. Treat it as "no document".
    if (!(documentBlob instanceof Blob)) { setBlobUrl(null); return; }
    const url = URL.createObjectURL(documentBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [documentBlob]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcuts, true);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts, true);
  }, [handleKeyboardShortcuts]);

  // Measure the rendered page box for the overlay seam. Only wired when a
  // caller actually needs the overlay, so the common viewer pays nothing.
  useEffect(() => {
    if (!renderPageOverlay) return;
    const el = pageBoxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      // Same box, same object: this effect re-subscribes whenever the overlay
      // is rebuilt, and every fresh observer fires once on attach. Handing back
      // a new object for an unchanged box would push that pulse through the
      // page API and the toolbar for nothing.
      setPageBox((current) =>
        current &&
        Math.abs(current.width - rect.width) < 0.5 &&
        Math.abs(current.height - rect.height) < 0.5
          ? current
          : { width: rect.width, height: rect.height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [renderPageOverlay, blobUrl, stablePage, renderedPageWidth, zoom]);

  return (
    <PdfImmersiveProvider value={isImmersive}>
    <div
      ref={rootRef}
      className={cn("relative flex min-h-0 h-full w-full flex-1 flex-col overflow-hidden bg-ethereal-ink text-ethereal-marble", className)}
    >
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.02] mix-blend-color-burn" aria-hidden="true" />

      {showPdfChrome && !isImmersive && (
        <PdfToolbar
          blobUrl={blobUrl}
          canExport={canExport}
          supportsNativeShare={supportsNativeShare}
          isSharing={isSharing}
          isDownloading={isDownloading}
          inset={reserveTopRight}
          onOpenInBrowser={handleOpenInBrowser}
          onShare={handleShare}
          onDownload={handleDownload}
          onEnterImmersive={handleEnterImmersive}
        />
      )}

      {/* Annotation tools live top-LEFT; the top-right corner is the utility
          pill (open / share / download). The width is capped so the two can
          never overlap on a phone, and the toolbar owns its own chrome +
          collapse-to-trigger so it isn't always occupying the top. Kept in
          immersive too — the score is annotatable in performance mode; the
          toolbar starts collapsed there for a clean stage. */}
      {showPdfChrome && toolbarSlot && (
        <div
          className="pointer-events-none absolute left-3 top-4 z-20 max-w-[calc(100vw-9rem)] sm:left-6 sm:top-6 sm:max-w-[calc(100vw-13rem)]"
          data-pdf-gesture-exempt
        >
          {toolbarSlot}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={viewportRef}
          // data-pdf-viewport marks the scroll container for overlay content
          // that re-implements panning (e.g. finger-pan while a pen tool draws).
          data-pdf-viewport
          className={cn(
            "ethereal-scroll h-full overflow-auto overscroll-contain",
            // Performance mode floats nothing over the page, so every inset
            // here is black frame the reader has to squint past.
            isImmersive ? "p-0" : "px-2 pb-8 pt-4 sm:px-6 sm:pb-32 sm:pt-6",
          )}
          style={{ touchAction: isPannableX ? "pan-x pan-y" : "pan-y" }}
        >
          {/* items-center vertically centres a page that fits (mobile letterbox
              → chrome sits in the top/bottom margins, off the music); with
              min-h-full it's overflow-safe — a taller-than-viewport (zoomed)
              page grows the box, so centring collapses to top-aligned + scroll. */}
          <div className="mx-auto flex min-h-full w-full items-center justify-center">
            {showLoadingState ? (
              <div className="flex min-h-full w-full items-center justify-center py-16"><EtherealLoader /></div>
            ) : isFetchError ? (
              <div className="flex min-h-full w-full items-center justify-center px-6 py-12 sm:px-10">
                <StatePanel
                  tone="danger"
                  icon={<FileWarning size={28} className="text-ethereal-crimson" aria-hidden="true" />}
                  title={t("pdf_viewer.unavailable_title", "Document unavailable")}
                  description={errorMessage ?? t("pdf_viewer.error_generic", "The document could not be loaded.")}
                  actions={<Button variant="secondary" onClick={handleRetry}>{t("common.actions.retry", "Retry")}</Button>}
                  className="w-full max-w-md shadow-glass-ethereal"
                />
              </div>
            ) : blobUrl && renderedPageWidth ? (
              <Document
                file={blobUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={flagViewerError}
                onSourceError={flagViewerError}
                loading={<div className="flex min-h-full w-full items-center justify-center py-16"><EtherealLoader /></div>}
                className="mx-auto"
              >
                {/* Page window: the stable page sits in flow and defines the
                    box; the target + neighbours render invisibly on top so a
                    page turn swaps two READY canvases — no loader, no flash.
                    This element is also the pinch-preview transform target. */}
                <div ref={pageBoxRef} className="relative w-fit">
                  {pagesToRender.map((page) => {
                    const isVisible = page === stablePage;
                    return (
                      <div
                        key={page}
                        className={isVisible ? "relative" : "invisible pointer-events-none absolute inset-0"}
                        aria-hidden={!isVisible}
                      >
                        <Page
                          pageNumber={page}
                          width={renderedPageWidth}
                          scale={zoom}
                          devicePixelRatio={devicePixelRatio}
                          canvasBackground="#ffffff"
                          renderAnnotationLayer
                          renderTextLayer
                          onRenderSuccess={() => markRendered(page)}
                          onLoadSuccess={
                            isVisible
                              ? (loaded) => {
                                  if (loaded.originalWidth > 0) {
                                    reportPageAspect(loaded.originalHeight / loaded.originalWidth);
                                  }
                                }
                              : undefined
                          }
                          onLoadError={flagViewerError}
                          onRenderError={flagViewerError}
                          loading={isVisible
                            ? <div className="flex min-h-[12rem] items-center justify-center py-8"><EtherealLoader /></div>
                            : null}
                          // Edge-to-edge in performance mode: a rounded corner
                          // over a full-bleed page would clip actual music.
                          className={cn(
                            "overflow-hidden bg-white",
                            !isImmersive && "rounded-surface shadow-glass-ethereal",
                            !isImmersive && isCompactViewport && "rounded-nested",
                          )}
                        />
                      </div>
                    );
                  })}
                  {renderPageOverlay && pageBox && (
                    // z-10 lifts the annotation surface ABOVE react-pdf's
                    // text layer (z-index 2) and annotation layer (z-index 3)
                    // so pen/comment input is captured instead of being
                    // swallowed by native text selection. In browse mode the
                    // surface is pointer-events:none, so text selection still
                    // passes through to the layer below.
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      data-pdf-gesture-exempt
                      data-pdf-pinch-through
                    >
                      {renderPageOverlay({
                        pageNumber: stablePage,
                        width: pageBox.width,
                        height: pageBox.height,
                        scale: zoom,
                      })}
                    </div>
                  )}
                </div>
              </Document>
            ) : (
              <div className="flex min-h-full w-full items-center justify-center py-16"><EtherealLoader /></div>
            )}
          </div>
        </div>

        {/* Whole-viewer overlay (annotation index / page rail). Spans the page
            area only; content opts back into pointer events on its own surface. */}
        {showPdfChrome && overlaySlot && (
          <div className="pointer-events-none absolute inset-0 z-20" data-pdf-gesture-exempt>
            {overlaySlot}
          </div>
        )}

        {/* Outline drawer — only for documents that carry bookmarks (e.g. the
            concert score-book): left-edge tab, tap a piece → jump to its page. */}
        {showPdfChrome && outline.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20" data-pdf-gesture-exempt>
            <PdfOutlineDrawer
              entries={outline}
              currentPage={currentPage}
              onJump={changePage}
            />
          </div>
        )}
      </div>

      {showPdfChrome && !isImmersive && (
        <PdfBottomNav
          currentPage={currentPage}
          numPages={numPages}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomStep={ZOOM_STEP}
          fitMode={fitMode}
          resolvedFit={resolvedFit}
          onFitModeChange={setFitMode}
          canTurnBack={canTurnBack}
          canTurnForward={canTurnForward}
          onTurn={turnPage}
          onZoomChange={changeZoom}
          onResetZoom={resetZoom}
        />
      )}

      {/* Transient feedback chip: immersive hint + page position feedback. */}
      <AnimatePresence>
        {chip && (
          <motion.div
            key={chip.id}
            initial={{ opacity: 0, x: "-50%", y: 8 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-8 left-1/2 z-30 rounded-full border border-white/10 bg-ethereal-ink/90 px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
            data-pdf-gesture-exempt
          >
            <Text className="text-xs font-medium tabular-nums tracking-wider text-ethereal-marble">
              {chip.text}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PdfImmersiveProvider>
  );
};
