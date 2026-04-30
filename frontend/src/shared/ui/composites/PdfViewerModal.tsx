/**
 * @file PdfViewerModal.tsx
 * @description Mobile-first authenticated PDF viewer with resilient lifecycle,
 * accessible dialog semantics, and thumb-friendly controls for dense documents.
 * @module shared/ui/composites/PdfViewerModal
 */

import React, {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileWarning,
  Globe,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

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

type ViewerStatus = "idle" | "loading" | "success" | "error";

type BlobFetchError = {
  response?: {
    status?: number;
  };
};

type CloseWatcherHandle = {
  onclose: (() => void) | null;
  destroy: () => void;
};

type CloseWatcherWindow = Window & {
  CloseWatcher?: new () => CloseWatcherHandle;
};

export interface PdfViewerModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  fileName?: string;
  fetchBlob: (() => Promise<Blob>) | null;
  docKey?: string | number;
  onClose: () => void;
}

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sanitizeFileName = (value: string): string =>
  value.replace(/[\\/:*?"<>|]+/g, "_").trim();

const buildPdfFileName = (title: string, fileName?: string): string => {
  const baseName = sanitizeFileName(fileName?.trim() || title.trim() || "document");
  return baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName}.pdf`;
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

const StatePanel = ({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.JSX.Element => (
  <div className="flex min-h-full w-full items-center justify-center px-6 py-12 sm:px-10">
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-ethereal-gold">
        {icon}
      </div>
      <div className="space-y-2">
        <Heading
          as="h3"
          size="lg"
          className="text-ethereal-marble text-balance"
        >
          {title}
        </Heading>
        <Text color="parchment-muted" className="text-balance">
          {description}
        </Text>
      </div>
      {action}
    </div>
  </div>
);

export const PdfViewerModal = ({
  isOpen,
  title,
  subtitle,
  fileName,
  fetchBlob,
  docKey,
  onClose,
}: PdfViewerModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const documentBlobRef = useRef<Blob | null>(null);

  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

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

  const revokeObjectUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    documentBlobRef.current = null;
  }, []);

  const clearDocumentResource = useCallback(() => {
    revokeObjectUrl();
    setBlobUrl(null);
  }, [revokeObjectUrl]);

  const resetViewerState = useCallback(() => {
    setStatus("idle");
    setNumPages(null);
    setCurrentPage(1);
    setZoom(DEFAULT_ZOOM);
    setErrorMsg(null);
    setIsDownloading(false);
    setIsSharing(false);
  }, []);

  const resolveViewerErrorMessage = useEffectEvent((error: unknown): string => {
    const blobError = error as BlobFetchError | undefined;

    return blobError?.response?.status === 403
      ? t(
          "pdf_viewer.error_403",
          "You do not have permission to view this document.",
        )
      : t("pdf_viewer.error_generic", "The document could not be loaded.");
  });

  const flagViewerError = useEffectEvent((error: unknown) => {
    setStatus("error");
    setErrorMsg(resolveViewerErrorMessage(error));
  });

  const ensureDocumentBlob = useEffectEvent(async (): Promise<Blob | null> => {
    if (documentBlobRef.current) {
      return documentBlobRef.current;
    }

    if (!fetchBlob) {
      return null;
    }

    const blob = await fetchBlob();
    documentBlobRef.current = blob;
    return blob;
  });

  const loadDocument = useEffectEvent(async (requestId: number) => {
    if (!fetchBlob) {
      return;
    }

    try {
      const blob = await fetchBlob();

      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      const nextBlobUrl = URL.createObjectURL(blob);

      blobUrlRef.current = nextBlobUrl;
      documentBlobRef.current = blob;

      setBlobUrl(nextBlobUrl);
      setStatus("success");
    } catch (error) {
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      flagViewerError(error);
    }
  });

  const changePage = useCallback(
    (nextPage: number) => {
      if (!numPages) {
        return;
      }

      startTransition(() => {
        setCurrentPage(clampValue(nextPage, 1, numPages));
      });
    },
    [numPages],
  );

  const changeZoom = useCallback((delta: number) => {
    startTransition(() => {
      setZoom((currentZoom) =>
        clampValue(
          Number((currentZoom + delta).toFixed(2)),
          MIN_ZOOM,
          MAX_ZOOM,
        ),
      );
    });
  }, []);

  const resetZoom = useCallback(() => {
    startTransition(() => {
      setZoom(DEFAULT_ZOOM);
    });
  }, []);

  const handleRetry = useCallback(() => {
    startTransition(() => {
      setRetryNonce((currentNonce) => currentNonce + 1);
    });
  }, []);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: totalPages }: { numPages: number }) => {
      setNumPages(totalPages);

      startTransition(() => {
        setCurrentPage((page) => clampValue(page, 1, totalPages));
      });
    },
    [],
  );

  const handleOpenInBrowser = useCallback(() => {
    if (!blobUrl) {
      return;
    }

    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }, [blobUrl]);

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);

    try {
      const blob = await ensureDocumentBlob();

      if (!blob) {
        return;
      }

      createDownloadAnchor(blob, resolvedFileName);
    } catch (error) {
      flagViewerError(error);
    } finally {
      setIsDownloading(false);
    }
  }, [ensureDocumentBlob, flagViewerError, isDownloading, resolvedFileName]);

  const handleShare = useCallback(async () => {
    if (!supportsNativeShare || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const blob = await ensureDocumentBlob();

      if (!blob) {
        return;
      }

      const shareFile = new File([blob], resolvedFileName, {
        type: blob.type || "application/pdf",
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
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        flagViewerError(error);
      }
    } finally {
      setIsSharing(false);
    }
  }, [
    ensureDocumentBlob,
    flagViewerError,
    handleDownload,
    isSharing,
    resolvedFileName,
    subtitle,
    supportsNativeShare,
    title,
  ]);

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (status !== "success") {
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

  useEffect(() => {
    if (!isOpen) {
      activeRequestIdRef.current += 1;
      clearDocumentResource();
      resetViewerState();
      return;
    }

    if (!fetchBlob) {
      setStatus("loading");
      return;
    }

    const nextRequestId = activeRequestIdRef.current + 1;

    activeRequestIdRef.current = nextRequestId;
    clearDocumentResource();
    setStatus("loading");
    setNumPages(null);
    setCurrentPage(1);
    setZoom(DEFAULT_ZOOM);
    setErrorMsg(null);

    void loadDocument(nextRequestId);
  }, [
    clearDocumentResource,
    docKey,
    fetchBlob,
    isOpen,
    loadDocument,
    resetViewerState,
    retryNonce,
  ]);

  useEffect(() => {
    if (!isOpen || !viewportRef.current) {
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [handleKeyboardShortcuts, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const closeWatcherWindow = window as CloseWatcherWindow;

    if (!closeWatcherWindow.CloseWatcher) {
      return;
    }

    const watcher = new closeWatcherWindow.CloseWatcher();
    watcher.onclose = () => {
      onClose();
    };

    return () => {
      try {
        watcher.destroy();
      } catch {
        // CloseWatcher implementations may throw when already released.
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      activeRequestIdRef.current += 1;
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  const showLoadingState =
    status === "loading" || (status === "idle" && isOpen && !blobUrl);
  const showPdfChrome = status === "success" && blobUrl && numPages !== null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      {isOpen && (
        <Dialog.Portal>
          <Dialog.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[120] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),rgba(8,8,10,0.92)] backdrop-blur-xl"
            />
          </Dialog.Overlay>

          <Dialog.Content
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              closeButtonRef.current?.focus();
            }}
            className="fixed inset-0 z-[121] outline-none sm:p-4"
            aria-describedby={subtitle ? descriptionId : undefined}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-full w-full flex-col overflow-hidden bg-[#111015] text-ethereal-marble sm:mx-auto sm:max-w-[min(100rem,calc(100vw-2rem))] sm:rounded-[2rem] sm:border sm:border-white/10 sm:shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,168,120,0.14),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_32%)]"
                aria-hidden="true"
              />

              <header className="relative z-10 border-b border-white/10 bg-black/20 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.875rem)] backdrop-blur-xl sm:px-6 sm:pb-4 sm:pt-6">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title asChild>
                      <Heading
                        id={titleId}
                        as="h2"
                        size="lg"
                        className="truncate text-ethereal-marble sm:text-[1.375rem]"
                      >
                        {title}
                      </Heading>
                    </Dialog.Title>

                    {subtitle ? (
                      <Dialog.Description asChild>
                        <Text
                          id={descriptionId}
                          color="parchment-muted"
                          className="mt-1 line-clamp-2"
                        >
                          {subtitle}
                        </Text>
                      </Dialog.Description>
                    ) : null}

                    {showPdfChrome && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Caption className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-ethereal-parchment/75">
                          {t("pdf_viewer.page_short", "Page")} {currentPage} /{" "}
                          {numPages}
                        </Caption>
                        <Caption className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-ethereal-parchment/75">
                          {zoomPercentage}%
                        </Caption>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden items-center gap-2 sm:flex">
                      {blobUrl && (
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={handleOpenInBrowser}
                          aria-label={t(
                            "pdf_viewer.open_browser",
                            "Open in browser",
                          )}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          <Globe size={18} aria-hidden="true" />
                        </Button>
                      )}

                      {supportsNativeShare && showPdfChrome && (
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={handleShare}
                          isLoading={isSharing}
                          aria-label={t("pdf_viewer.share", "Share")}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          {!isSharing && <Share2 size={18} aria-hidden="true" />}
                        </Button>
                      )}

                      {showPdfChrome && (
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={handleDownload}
                          isLoading={isDownloading}
                          aria-label={t("pdf_viewer.download", "Download")}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          {!isDownloading && (
                            <Download size={18} aria-hidden="true" />
                          )}
                        </Button>
                      )}
                    </div>

                    <Button
                      ref={closeButtonRef}
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      aria-label={t("common.close_aria", "Close")}
                      className="h-11 w-11 rounded-2xl text-ethereal-marble hover:bg-white/10 hover:text-white"
                    >
                      <X size={18} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </header>

              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={viewportRef}
                  className="h-full overflow-auto overscroll-contain px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6"
                  style={{ touchAction: "pan-x pan-y pinch-zoom" }}
                >
                  <div className="mx-auto flex min-h-full w-full items-start justify-center">
                    {showLoadingState ? (
                      <div className="flex min-h-full w-full items-center justify-center py-16">
                        <EtherealLoader />
                      </div>
                    ) : status === "error" ? (
                      <StatePanel
                        icon={
                          <FileWarning
                            size={28}
                            className="text-ethereal-crimson/80"
                            aria-hidden="true"
                          />
                        }
                        title={t(
                          "pdf_viewer.unavailable_title",
                          "Document unavailable",
                        )}
                        description={
                          errorMsg ??
                          t(
                            "pdf_viewer.error_generic",
                            "The document could not be loaded.",
                          )
                        }
                        action={
                          <Button
                            variant="secondary"
                            onClick={handleRetry}
                            className="mt-1"
                          >
                            {t("common.actions.retry", "Retry")}
                          </Button>
                        }
                      />
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
                        <Page
                          pageNumber={currentPage}
                          width={renderedPageWidth}
                          scale={zoom}
                          devicePixelRatio={devicePixelRatio}
                          canvasBackground="#ffffff"
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          onLoadError={flagViewerError}
                          onRenderError={flagViewerError}
                          loading={
                            <div className="flex min-h-[12rem] items-center justify-center py-8">
                              <EtherealLoader />
                            </div>
                          }
                          className={cn(
                            "overflow-hidden rounded-[1.5rem] bg-white shadow-[0_32px_90px_rgba(0,0,0,0.35)]",
                            isCompactViewport && "rounded-[1.125rem]",
                          )}
                        />
                      </Document>
                    ) : (
                      <div className="flex min-h-full w-full items-center justify-center py-16">
                        <EtherealLoader />
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#111015] to-transparent"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#111015] to-transparent"
                  aria-hidden="true"
                />
              </div>

              {showPdfChrome && (
                <footer className="relative z-10 border-t border-white/10 bg-black/25 px-4 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] pt-3 backdrop-blur-xl sm:px-6 sm:pb-5 sm:pt-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => changePage(currentPage - 1)}
                          disabled={currentPage <= 1}
                          aria-label={t(
                            "pdf_viewer.prev_page",
                            "Previous page",
                          )}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          <ChevronLeft size={18} aria-hidden="true" />
                        </Button>

                        <div
                          aria-live="polite"
                          className="rounded-[1.125rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-center"
                        >
                          <Caption className="block text-[10px] uppercase tracking-[0.14em] text-ethereal-parchment/55">
                            {t("pdf_viewer.page_short", "Page")}
                          </Caption>
                          <Text
                            as="span"
                            className="block tabular-nums font-semibold text-ethereal-marble"
                          >
                            {currentPage} / {numPages}
                          </Text>
                        </div>

                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => changePage(currentPage + 1)}
                          disabled={currentPage >= numPages}
                          aria-label={t("pdf_viewer.next_page", "Next page")}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          <ChevronRight size={18} aria-hidden="true" />
                        </Button>
                      </div>

                      <div className="rounded-[1.125rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
                        <Caption className="block text-[10px] uppercase tracking-[0.14em] text-ethereal-parchment/55">
                          {t("pdf_viewer.zoom_short", "Zoom")}
                        </Caption>
                        <Text
                          as="span"
                          className="block tabular-nums font-semibold text-ethereal-marble"
                        >
                          {zoomPercentage}%
                        </Text>
                      </div>
                    </div>

                    {numPages > 1 && (
                      <div className="flex items-center gap-3">
                        <Caption className="min-w-8 tabular-nums text-ethereal-marble/45">
                          1
                        </Caption>
                        <input
                          type="range"
                          min={1}
                          max={numPages}
                          step={1}
                          value={currentPage}
                          onChange={(event) =>
                            changePage(Number(event.currentTarget.value))
                          }
                          aria-label={t("pdf_viewer.jump_to_page", "Jump to page")}
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-ethereal-gold"
                        />
                        <Caption className="min-w-8 text-right tabular-nums text-ethereal-marble/45">
                          {numPages}
                        </Caption>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => changeZoom(-ZOOM_STEP)}
                          disabled={zoom <= MIN_ZOOM}
                          aria-label={t("pdf_viewer.zoom_out", "Zoom out")}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          <ZoomOut size={18} aria-hidden="true" />
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={resetZoom}
                          aria-label={t("pdf_viewer.fit_width", "Fit width")}
                          className="h-11 rounded-2xl px-4 text-ethereal-marble"
                        >
                          {t("pdf_viewer.fit_width", "Fit width")}
                        </Button>

                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => changeZoom(ZOOM_STEP)}
                          disabled={zoom >= MAX_ZOOM}
                          aria-label={t("pdf_viewer.zoom_in", "Zoom in")}
                          className="h-11 w-11 rounded-2xl text-ethereal-marble"
                        >
                          <ZoomIn size={18} aria-hidden="true" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 sm:hidden">
                        {blobUrl && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleOpenInBrowser}
                            className="h-11 flex-1 rounded-2xl px-4 text-ethereal-marble"
                          >
                            {t("pdf_viewer.open_browser", "Open")}
                          </Button>
                        )}

                        {supportsNativeShare && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleShare}
                            isLoading={isSharing}
                            className="h-11 flex-1 rounded-2xl px-4 text-ethereal-marble"
                          >
                            {!isSharing && t("pdf_viewer.share", "Share")}
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDownload}
                          isLoading={isDownloading}
                          className="h-11 flex-1 rounded-2xl px-4 text-ethereal-marble"
                        >
                          {!isDownloading && t("pdf_viewer.download", "Download")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </footer>
              )}
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
};
