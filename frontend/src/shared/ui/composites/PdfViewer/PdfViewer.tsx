import React, { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { FileWarning } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";

import { PdfViewerProps, PdfViewerEvent, LoadErrorReason } from "./types";
import { ZOOM_STEP, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from "./constants";
import { clampValue, buildPdfFileName, classifyLoadError, createDownloadAnchor } from "./utils";
import { PdfToolbar } from "./components/PdfToolbar";
import { PdfBottomNav } from "./components/PdfBottomNav";
import { usePdfState } from "./hooks/usePdfState";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export const PdfViewer = ({
  fetchBlob,
  docKey,
  title,
  subtitle,
  fileName,
  onEvent,
  toolbarSlot,
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
  } = usePdfState();

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

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

  const emitEvent = useEffectEvent((event: PdfViewerEvent) => onEvent?.(event));

  const resolveViewerErrorMessage = useEffectEvent((reason: LoadErrorReason): string => {
    return reason === "permission_denied"
      ? t("pdf_viewer.error_403", "You do not have permission to view this document.")
      : t("pdf_viewer.error_generic", "The document could not be loaded.");
  });

  const flagViewerError = useEffectEvent((error: unknown) => {
    const reason = classifyLoadError(error);
    const message = error instanceof Error ? error.message : undefined;
    emitEvent({ type: "load_error", reason, message });
  });

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

  const handleDocumentLoadSuccess = useEffectEvent(({ numPages: totalPages }: { numPages: number }) => {
    setNumPages(totalPages);
    startTransition(() => setCurrentPage((page) => clampValue(page, 1, totalPages)));
    emitEvent({ type: "load_success", numPages: totalPages });
  });

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

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (!blobUrl || isFetchError) return;
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "")) return;

    if (event.key === "ArrowLeft") { event.preventDefault(); changePage(currentPage - 1); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); changePage(currentPage + 1); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); changeZoom(-ZOOM_STEP); return; }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(ZOOM_STEP); return; }
    if (event.key === "0") { event.preventDefault(); resetZoom(); }
  });

  useEffect(() => {
    if (docKey) emitEvent({ type: "open", docKey });
  }, [docKey, emitEvent]);

  useEffect(() => {
    if (!documentBlob) { setBlobUrl(null); return; }
    const url = URL.createObjectURL(documentBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [documentBlob]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [handleKeyboardShortcuts]);

  const isIdle = !fetchBlob;
  const showLoadingState = (isIdle && !blobUrl) || (!isIdle && isFetchingBlob && !blobUrl);
  const showPdfChrome = !!blobUrl && numPages !== null && !isFetchError;
  const errorReason = isFetchError ? classifyLoadError(fetchError) : null;
  const errorMessage = errorReason ? resolveViewerErrorMessage(errorReason) : null;

  return (
    <div className={cn("relative flex min-h-0 h-full w-full flex-1 flex-col overflow-hidden bg-ethereal-ink text-ethereal-marble", className)}>
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.02] mix-blend-color-burn" aria-hidden="true" />

      {showPdfChrome && (
        <PdfToolbar
          blobUrl={blobUrl}
          supportsNativeShare={supportsNativeShare}
          isSharing={isSharing}
          isDownloading={isDownloading}
          onOpenInBrowser={handleOpenInBrowser}
          onShare={handleShare}
          onDownload={handleDownload}
          toolbarSlot={toolbarSlot}
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={viewportRef}
          className="ethereal-scroll h-full overflow-auto overscroll-contain px-3 pb-8 pt-4 sm:px-6 sm:pb-32 sm:pt-6"
          style={{ touchAction: "pan-x pan-y pinch-zoom" }}
        >
          <div className="mx-auto flex min-h-full w-full items-start justify-center">
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
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Page
                      pageNumber={currentPage}
                      width={renderedPageWidth}
                      scale={zoom}
                      devicePixelRatio={devicePixelRatio}
                      canvasBackground="#ffffff"
                      renderAnnotationLayer
                      renderTextLayer
                      onLoadError={flagViewerError}
                      onRenderError={flagViewerError}
                      loading={<div className="flex min-h-[12rem] items-center justify-center py-8"><EtherealLoader /></div>}
                      className={cn("overflow-hidden rounded-[1.5rem] bg-white shadow-glass-ethereal", isCompactViewport && "rounded-[1.125rem]")}
                    />
                  </motion.div>
                </AnimatePresence>
              </Document>
            ) : (
              <div className="flex min-h-full w-full items-center justify-center py-16"><EtherealLoader /></div>
            )}
          </div>
        </div>
      </div>

      {showPdfChrome && (
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
    </div>
  );
};
