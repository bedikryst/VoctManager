/**
 * @file PdfViewer.tsx
 * @description Headless authenticated PDF viewing primitive. Owns the rendering pipeline
 * (text + annotation layers, virtualized worker, responsive page sizing), action toolbar
 * (download, share, open-in-browser, zoom, page nav), and a typed onEvent telemetry seam.
 * Uses TanStack Query for blob fetching, fulfilling the 2026 architecture mandate.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer
 */

import React, {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileWarning,
  Globe,
  Share2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

// pdf.js worker bootstrap. Vite resolves this URL at build time and emits the worker
// as a separate chunk. Module-level so it runs exactly once per page load.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
const COMPACT_VIEWPORT_THRESHOLD = 640;
const MOBILE_MIN_PAGE_WIDTH = 260;
const DESKTOP_MIN_PAGE_WIDTH = 320;
const DESKTOP_PAGE_WIDTH_CAP = 1080;

type LoadErrorReason = "permission_denied" | "network" | "parse" | "unknown";

type BlobFetchError = {
  response?: {
    status?: number;
  };
  message?: string;
};

/**
 * Telemetry event union emitted by the viewer. Consumers can wire this to any
 * audit/analytics sink (no transport is bundled in the primitive itself).
 */
export type PdfViewerEvent =
  | { type: "open"; docKey?: string | number }
  | { type: "load_success"; numPages: number }
  | { type: "load_error"; reason: LoadErrorReason; message?: string }
  | { type: "page_change"; from: number; to: number }
  | { type: "zoom_change"; from: number; to: number }
  | { type: "download"; fileName: string; succeeded: boolean }
  | { type: "share"; fileName: string; succeeded: boolean; cancelled: boolean }
  | { type: "open_in_browser" }
  | { type: "retry" };

export interface PdfViewerProps {
  /** Resolves the document blob. Pass `null` to suspend rendering (e.g. before metadata is ready). */
  fetchBlob: (() => Promise<Blob>) | null;
  /** Stable identity of the current document. Changing this triggers a refetch. */
  docKey?: string | number;
  /** Display title used for share text and as the download filename fallback. */
  title: string;
  /** Optional subtitle used as `text` payload for native share. */
  subtitle?: string;
  /** Override for the download filename. Defaults to a sanitized title. */
  fileName?: string;
  /** Optional telemetry seam — receives a typed event for each user-visible action. */
  onEvent?: (event: PdfViewerEvent) => void;
  /** Slot rendered to the right of the action group in the top toolbar. */
  toolbarSlot?: React.ReactNode;
  /** Caller-side wrapper class (typically scope-specific layout). */
  className?: string;
}

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sanitizeFileName = (value: string): string =>
  value.replace(/[\\/:*?"<>|]+/g, "_").trim();

const buildPdfFileName = (title: string, fileName?: string): string => {
  const baseName = sanitizeFileName(fileName?.trim() || title.trim() || "document");
  return baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName}.pdf`;
};

const classifyLoadError = (error: unknown): LoadErrorReason => {
  const blobError = error as BlobFetchError | undefined;
  const status = blobError?.response?.status;

  if (status === 401 || status === 403) {
    return "permission_denied";
  }
  if (typeof status === "number" && status >= 400) {
    return "network";
  }
  if (error instanceof Error && /pdf|parse|invalid|password/i.test(error.message)) {
    return "parse";
  }
  if (error instanceof Error && /network|fetch|timeout/i.test(error.message)) {
    return "network";
  }
  return "unknown";
};

const createDownloadAnchor = (blob: Blob, targetFileName: string): void => {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = targetFileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
};

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

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // TanStack Query for data fetching
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

  const isCompactViewport =
    viewportWidth > 0 && viewportWidth < COMPACT_VIEWPORT_THRESHOLD;

  const renderedPageWidth = useMemo(() => {
    if (viewportWidth <= 0) {
      return undefined;
    }

    const horizontalPadding = isCompactViewport ? 24 : 72;
    const availableWidth = Math.max(0, viewportWidth - horizontalPadding);
    const targetWidth = isCompactViewport
      ? availableWidth
      : Math.min(availableWidth, DESKTOP_PAGE_WIDTH_CAP);

    return Math.max(
      isCompactViewport ? MOBILE_MIN_PAGE_WIDTH : DESKTOP_MIN_PAGE_WIDTH,
      Math.floor(targetWidth),
    );
  }, [isCompactViewport, viewportWidth]);

  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);

  const devicePixelRatio = useMemo(() => {
    if (typeof window === "undefined") {
      return 1;
    }

    return Math.min(window.devicePixelRatio || 1, 2);
  }, []);

  const supportsNativeShare = useMemo(() => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function" ||
      typeof File === "undefined"
    ) {
      return false;
    }

    try {
      if (typeof navigator.canShare !== "function") {
        return true;
      }

      return navigator.canShare({
        files: [new File([""], resolvedFileName, { type: "application/pdf" })],
      });
    } catch {
      return false;
    }
  }, [resolvedFileName]);

  const emitEvent = useEffectEvent((event: PdfViewerEvent) => {
    onEvent?.(event);
  });

  const resolveViewerErrorMessage = useEffectEvent((reason: LoadErrorReason): string => {
    return reason === "permission_denied"
      ? t(
          "pdf_viewer.error_403",
          "You do not have permission to view this document.",
        )
      : t("pdf_viewer.error_generic", "The document could not be loaded.");
  });

  const flagViewerError = useEffectEvent((error: unknown) => {
    const reason = classifyLoadError(error);
    const message = error instanceof Error ? error.message : undefined;
    emitEvent({ type: "load_error", reason, message });
  });

  const changePage = useCallback(
    (nextPage: number) => {
      if (!numPages) {
        return;
      }

      const clamped = clampValue(nextPage, 1, numPages);

      if (currentPage !== clamped) {
        emitEvent({ type: "page_change", from: currentPage, to: clamped });
        setCurrentPage(clamped);
      }
    },
    [emitEvent, numPages, currentPage],
  );

  const changeZoom = useCallback(
    (delta: number) => {
      const next = clampValue(
        Number((zoom + delta).toFixed(2)),
        MIN_ZOOM,
        MAX_ZOOM,
      );

      if (next !== zoom) {
        emitEvent({ type: "zoom_change", from: zoom, to: next });
        startTransition(() => {
          setZoom(next);
        });
      }
    },
    [emitEvent, zoom],
  );

  const resetZoom = useCallback(() => {
    if (zoom !== DEFAULT_ZOOM) {
      emitEvent({
        type: "zoom_change",
        from: zoom,
        to: DEFAULT_ZOOM,
      });
      startTransition(() => {
        setZoom(DEFAULT_ZOOM);
      });
    }
  }, [emitEvent, zoom]);

  const handleRetry = useCallback(() => {
    emitEvent({ type: "retry" });
    retryFetch();
  }, [emitEvent, retryFetch]);

  const handleDocumentLoadSuccess = useEffectEvent(
    ({ numPages: totalPages }: { numPages: number }) => {
      setNumPages(totalPages);

      startTransition(() => {
        setCurrentPage((page) => clampValue(page, 1, totalPages));
      });

      emitEvent({ type: "load_success", numPages: totalPages });
    },
  );

  const handleOpenInBrowser = useCallback(() => {
    if (!blobUrl) {
      return;
    }

    window.open(blobUrl, "_blank", "noopener,noreferrer");
    emitEvent({ type: "open_in_browser" });
  }, [blobUrl, emitEvent]);

  const handleDownload = useCallback(async () => {
    if (isDownloading || !documentBlob) {
      return;
    }

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
  }, [
    documentBlob,
    emitEvent,
    flagViewerError,
    isDownloading,
    resolvedFileName,
  ]);

  const handleShare = useCallback(async () => {
    if (!supportsNativeShare || isSharing || !documentBlob) {
      return;
    }

    setIsSharing(true);

    let succeeded = false;
    let cancelled = false;
    try {
      const shareFile = new File([documentBlob], resolvedFileName, {
        type: documentBlob.type || "application/pdf",
      });

      if (
        typeof navigator.canShare === "function" &&
        !navigator.canShare({ files: [shareFile] })
      ) {
        await handleDownload();
        return;
      }

      await navigator.share({
        files: [shareFile],
        title,
        text: subtitle,
      });
      succeeded = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        cancelled = true;
      } else {
        flagViewerError(error);
      }
    } finally {
      setIsSharing(false);
      emitEvent({
        type: "share",
        fileName: resolvedFileName,
        succeeded,
        cancelled,
      });
    }
  }, [
    documentBlob,
    emitEvent,
    flagViewerError,
    handleDownload,
    isSharing,
    resolvedFileName,
    subtitle,
    supportsNativeShare,
    title,
  ]);

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (!blobUrl || isFetchError) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const isInteractiveField =
      target?.isContentEditable ||
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT";

    if (isInteractiveField) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      changePage(currentPage - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      changePage(currentPage + 1);
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      changeZoom(-ZOOM_STEP);
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(ZOOM_STEP);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      resetZoom();
    }
  });

  // Track document key and emit open event
  useEffect(() => {
    if (docKey) {
      emitEvent({ type: "open", docKey });
    }
  }, [docKey, emitEvent]);

  // Object URL lifecycle
  useEffect(() => {
    if (!documentBlob) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(documentBlob);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [documentBlob]);

  // Track viewport width for responsive page sizing.
  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    const element = viewportRef.current;
    const updateViewportWidth = (): void => {
      setViewportWidth(element.clientWidth);
    };

    updateViewportWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportWidth);
      return () => {
        window.removeEventListener("resize", updateViewportWidth);
      };
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setViewportWidth(entry?.contentRect.width ?? element.clientWidth);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Keyboard shortcuts (←/→ paging, +/-/0 zoom).
  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [handleKeyboardShortcuts]);

  // Computed state
  const isIdle = !fetchBlob;
  const showLoadingState = (isIdle && !blobUrl) || (!isIdle && isFetchingBlob && !blobUrl);
  const showPdfChrome = !!blobUrl && numPages !== null && !isFetchError;
  const errorReason = isFetchError ? classifyLoadError(fetchError) : null;
  const errorMessage = errorReason ? resolveViewerErrorMessage(errorReason) : null;

  return (
    <div
      className={cn(
        "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-ethereal-ink text-ethereal-marble",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-noise opacity-[0.02] mix-blend-color-burn"
        aria-hidden="true"
      />

      {showPdfChrome && (
        <div className="absolute right-4 top-4 z-20 flex items-center sm:right-6 sm:top-6">
          <GlassCard
            variant="surface"
            padding="sm"
            className="flex items-center gap-1 rounded-full p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            isHoverable={false}
          >
            {blobUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenInBrowser}
                aria-label={t("pdf_viewer.open_browser", "Open in browser")}
                className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
              >
                <Globe size={16} aria-hidden="true" />
              </Button>
            )}

            {supportsNativeShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                isLoading={isSharing}
                aria-label={t("pdf_viewer.share", "Share")}
                className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
              >
                {!isSharing && <Share2 size={16} aria-hidden="true" />}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              isLoading={isDownloading}
              aria-label={t("pdf_viewer.download", "Download")}
              className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              {!isDownloading && <Download size={16} aria-hidden="true" />}
            </Button>

            {toolbarSlot && (
              <>
                <div className="mx-1 h-4 w-px bg-white/15" />
                {toolbarSlot}
              </>
            )}
          </GlassCard>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={viewportRef}
          className="ethereal-scroll h-full overflow-auto overscroll-contain px-3 pb-8 pt-4 sm:px-6 sm:pb-32 sm:pt-6"
          style={{ touchAction: "pan-x pan-y pinch-zoom" }}
        >
          <div className="mx-auto flex min-h-full w-full items-start justify-center">
            {showLoadingState ? (
              <div className="flex min-h-full w-full items-center justify-center py-16">
                <EtherealLoader />
              </div>
            ) : isFetchError ? (
              <div className="flex min-h-full w-full items-center justify-center px-6 py-12 sm:px-10">
                <StatePanel
                  tone="danger"
                  icon={
                    <FileWarning
                      size={28}
                      className="text-ethereal-crimson"
                      aria-hidden="true"
                    />
                  }
                  title={t(
                    "pdf_viewer.unavailable_title",
                    "Document unavailable",
                  )}
                  description={
                    errorMessage ??
                    t(
                      "pdf_viewer.error_generic",
                      "The document could not be loaded.",
                    )
                  }
                  actions={
                    <Button
                      variant="secondary"
                      onClick={handleRetry}
                    >
                      {t("common.actions.retry", "Retry")}
                    </Button>
                  }
                  className="w-full max-w-md shadow-glass-ethereal"
                />
              </div>
            ) : blobUrl && renderedPageWidth ? (
              <Document
                file={blobUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={flagViewerError}
                onSourceError={flagViewerError}
                loading={
                  <div className="flex min-h-full w-full items-center justify-center py-16">
                    <EtherealLoader />
                  </div>
                }
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
                      loading={
                        <div className="flex min-h-[12rem] items-center justify-center py-8">
                          <EtherealLoader />
                        </div>
                      }
                      className={cn(
                        "overflow-hidden rounded-[1.5rem] bg-white shadow-glass-ethereal",
                        isCompactViewport && "rounded-[1.125rem]",
                      )}
                    />
                  </motion.div>
                </AnimatePresence>
              </Document>
            ) : (
              <div className="flex min-h-full w-full items-center justify-center py-16">
                <EtherealLoader />
              </div>
            )}
          </div>
        </div>
      </div>

      {showPdfChrome && (
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex justify-center pb-[env(safe-area-inset-bottom)] sm:bottom-8">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-ethereal-ink/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md border border-white/10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={t("pdf_viewer.prev_page", "Previous page")}
              className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Button>

            <div className="flex min-w-[4rem] items-center justify-center px-1">
              <Text className="text-xs font-medium tabular-nums tracking-wider text-ethereal-marble">
                {currentPage} <span className="text-white/40">/ {numPages}</span>
              </Text>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage >= numPages}
              aria-label={t("pdf_viewer.next_page", "Next page")}
              className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </Button>

            <div className="mx-1 h-5 w-px bg-white/15" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label={t("pdf_viewer.zoom_out", "Zoom out")}
              className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              <ZoomOut size={18} aria-hidden="true" />
            </Button>

            <div
              className="flex min-w-[4rem] cursor-pointer items-center justify-center px-1 transition-colors hover:text-white"
              onClick={resetZoom}
              title={t("pdf_viewer.fit_width", "Fit width")}
            >
              <Text className="text-xs font-medium tabular-nums tracking-wider text-ethereal-marble">
                {zoomPercentage}%
              </Text>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label={t("pdf_viewer.zoom_in", "Zoom in")}
              className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              <ZoomIn size={18} aria-hidden="true" />
            </Button>
        </div>
        </div>
      )}
      
    </div>
  );
};
