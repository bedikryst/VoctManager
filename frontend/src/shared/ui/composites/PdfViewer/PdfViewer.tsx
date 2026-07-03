/**
 * @file PdfViewer.tsx
 * @description Headless, gated PDF reading instrument. Renders a prefetched
 * page window (current ± neighbours) so page turns swap two ready canvases
 * instead of flashing a loader; adds edge-tap/swipe/pedal-key navigation,
 * pinch and ctrl+wheel zoom with a live CSS preview, a screen wake lock and an
 * immersive performance mode (fullscreen, chrome hidden). Annotation features
 * mount through the toolbarSlot / renderPageOverlay / overlaySlot seams.
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
  PANNABLE_ZOOM_THRESHOLD,
  PREFETCH_MAX_ZOOM,
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

export const PdfViewer = ({
  fetchBlob,
  docKey,
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
  className,
}: PdfViewerProps): React.JSX.Element => {
  const { t } = useTranslation();

  const {
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
  } = usePdfState();

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
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
    staleTime: Infinity,
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

  const emitEvent = useCallback(
    (event: PdfViewerEvent) => onEvent?.(event),
    [onEvent],
  );

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

  const changePage = useCallback((nextPage: number) => {
    if (!numPages) return;
    const clamped = clampValue(nextPage, 1, numPages);
    if (currentPage !== clamped) {
      emitEvent({ type: "page_change", from: currentPage, to: clamped });
      setCurrentPage(clamped);
    }
  }, [emitEvent, numPages, currentPage, setCurrentPage]);

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

  const handleImmersiveChange = useCallback((active: boolean) => {
    emitEvent({ type: "immersive_change", active });
  }, [emitEvent]);

  const { isImmersive, enter: enterImmersive, exit: exitImmersive } =
    useImmersiveMode(rootRef, handleImmersiveChange);

  const handleEnterImmersive = useCallback(() => {
    enterImmersive();
    showChip(
      t("pdf_viewer.immersive_hint", "Tap the centre of the screen to exit"),
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

  // Page turn shows the top of the new page, like turning paper.
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [stablePage, viewportRef]);

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
    changePage(currentPage + delta);
  }, [changePage, currentPage]);

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

  const isPannableX = zoom > PANNABLE_ZOOM_THRESHOLD;

  useViewerGestures({
    viewportRef,
    pinchTargetRef: pageBoxRef,
    enabled: showPdfChrome,
    swipeEnabled: !isPannableX,
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
      changePage(currentPage - 1);
      return;
    }
    if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key) || (isSpace && !event.shiftKey)) {
      event.preventDefault();
      changePage(currentPage + 1);
      return;
    }
    if (event.key === "Home") { event.preventDefault(); changePage(1); return; }
    if (event.key === "End" && numPages) { event.preventDefault(); changePage(numPages); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); changeZoom(-ZOOM_STEP); return; }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(ZOOM_STEP); return; }
    if (event.key === "0") { event.preventDefault(); resetZoom(); }
  }, [blobUrl, isFetchError, isImmersive, exitImmersive, changePage, currentPage, numPages, changeZoom, resetZoom]);

  useEffect(() => {
    if (docKey) emitEvent({ type: "open", docKey });
  }, [docKey, emitEvent]);

  // Surface the live page handle so an overlaySlot can drive navigation.
  useEffect(() => {
    onPageApiChange?.({ currentPage, numPages, goToPage: changePage });
  }, [onPageApiChange, currentPage, numPages, changePage]);

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
      if (rect && rect.width > 0 && rect.height > 0) {
        setPageBox({ width: rect.width, height: rect.height });
      }
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
          className="ethereal-scroll h-full overflow-auto overscroll-contain px-2 pb-8 pt-4 sm:px-6 sm:pb-32 sm:pt-6"
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
                          className={cn("overflow-hidden rounded-[1.5rem] bg-white shadow-glass-ethereal", isCompactViewport && "rounded-[1.125rem]")}
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
                    <div className="pointer-events-none absolute inset-0 z-10" data-pdf-gesture-exempt>
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
          onPageChange={changePage}
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
