// shared/ui/composites/PdfViewerModal.tsx
// Generic authenticated PDF viewer modal.
// Pass `fetchBlob` as a memoized (useCallback) function; re-fetches when `docKey` changes.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileWarning,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "./GlassCard";
import { Button } from "../primitives/Button";
import { Text, Caption } from "../primitives/typography";
import { EtherealLoader } from "../kinematics/EtherealLoader";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type ViewerStatus = "idle" | "loading" | "success" | "error";

export interface PdfViewerModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  fileName?: string;
  /** Stable (useCallback-memoized) fetch function. Null while modal should not fetch. */
  fetchBlob: (() => Promise<Blob>) | null;
  /** When this key changes while open, re-fetches (e.g. different document id). */
  docKey?: string | number;
  onClose: () => void;
}

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

  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const blobUrlRef = useRef<string | null>(null);
  // Always keep the latest fetchBlob without making it an effect dependency.
  const fetchBlobRef = useRef<typeof fetchBlob>(fetchBlob);
  fetchBlobRef.current = fetchBlob;

  useEffect(() => {
    if (!isOpen || !fetchBlobRef.current) return;

    let mounted = true;

    setStatus("loading");
    setNumPages(null);
    setCurrentPage(1);
    setScale(1.25);
    setErrorMsg(null);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }

    fetchBlobRef
      .current()
      .then((blob) => {
        if (!mounted) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setStatus("success");
      })
      .catch((err: { response?: { status?: number } }) => {
        if (!mounted) return;
        setErrorMsg(
          err?.response?.status === 403
            ? t(
                "pdf_viewer.error_403",
                "You do not have permission to view this document.",
              )
            : t(
                "pdf_viewer.error_generic",
                "The document could not be loaded.",
              ),
        );
        setStatus("error");
      });

    return () => {
      mounted = false;
    };
    // docKey is the stable semantic key for "which document"; isOpen for open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, docKey]);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Safety-net revoke on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }
    setStatus("idle");
    setNumPages(null);
    setCurrentPage(1);
    setScale(1.0);
    onClose();
  }, [onClose]);

  const handleDownload = useCallback(() => {
    const fn = fetchBlobRef.current;
    if (!fn) return;
    if (blobUrlRef.current) {
      const a = window.document.createElement("a");
      a.href = blobUrlRef.current;
      a.download = fileName ?? title;
      a.click();
    } else {
      fn().then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = fileName ?? title;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }, [fileName, title]);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => setNumPages(total),
    [],
  );

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-90 flex items-center justify-center p-1.5 sm:p-3 bg-ethereal-ink/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-5xl"
            style={{ height: "calc(100dvh - 1.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard
              variant="ethereal"
              padding="none"
              className="shadow-glass-ethereal h-full"
            >
              {/*
                Inner flex wrapper is necessary because GlassCard inserts
                its own <div className="relative z-10 h-full"> (block, not flex).
                We need our own flex container to make the scroll area work.
              */}
              <div className="flex flex-col h-full">
                {/* ── Header ── */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-ethereal-incense/15 shrink-0">
                  <div className="flex-1 min-w-0">
                    <Text
                      weight="semibold"
                      className="text-ethereal-ink truncate block leading-snug"
                    >
                      {title}
                    </Text>
                    {subtitle && (
                      <Caption color="muted" className="block mt-0.5">
                        {subtitle}
                      </Caption>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownload}
                      aria-label={t("pdf_viewer.download", "Download")}
                    >
                      <Download size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClose}
                      aria-label={t("common.close_aria", "Close")}
                    >
                      <X size={18} aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* ── Scrollable PDF area ── */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-ethereal-alabaster/50">
                  <div className="flex items-start justify-center p-4 min-h-full">
                    {status === "loading" ? (
                      <div className="flex items-center justify-center w-full py-16">
                        <EtherealLoader />
                      </div>
                    ) : status === "error" ? (
                      <div className="flex flex-col items-center gap-3 py-16">
                        <FileWarning
                          size={40}
                          className="text-ethereal-crimson/40"
                          aria-hidden="true"
                        />
                        <Text color="muted">{errorMsg}</Text>
                      </div>
                    ) : blobUrl ? (
                      <Document
                        file={blobUrl}
                        onLoadSuccess={handleDocumentLoadSuccess}
                        loading={
                          <div className="flex items-center justify-center py-16 w-full">
                            <EtherealLoader />
                          </div>
                        }
                        className="flex flex-col items-center gap-4"
                      >
                        <Page
                          pageNumber={currentPage}
                          scale={scale}
                          loading={
                            <div className="py-8">
                              <EtherealLoader />
                            </div>
                          }
                          className="shadow-glass-solid rounded-lg overflow-hidden"
                        />
                      </Document>
                    ) : null}
                  </div>
                </div>

                {/* ── Footer toolbar ── */}
                {status === "success" && numPages !== null && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-ethereal-incense/15 bg-ethereal-alabaster/60 shrink-0 gap-4">
                    {/* Pagination */}
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage <= 1}
                        aria-label={t("pdf_viewer.prev_page", "Previous page")}
                      >
                        <ChevronLeft size={16} aria-hidden="true" />
                      </Button>
                      <Caption
                        color="muted"
                        className="tabular-nums whitespace-nowrap px-1.5"
                      >
                        {currentPage} / {numPages}
                      </Caption>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(numPages, p + 1))
                        }
                        disabled={currentPage >= numPages}
                        aria-label={t("pdf_viewer.next_page", "Next page")}
                      >
                        <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    </div>

                    {/* Zoom */}
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))
                        }
                        disabled={scale <= 0.5}
                        aria-label={t("pdf_viewer.zoom_out", "Zoom out")}
                      >
                        <ZoomOut size={16} aria-hidden="true" />
                      </Button>
                      <Caption
                        color="muted"
                        className="tabular-nums w-12 text-center"
                      >
                        {Math.round(scale * 100)}%
                      </Caption>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setScale((s) => Math.min(3.0, +(s + 0.25).toFixed(2)))
                        }
                        disabled={scale >= 3.0}
                        aria-label={t("pdf_viewer.zoom_in", "Zoom in")}
                      >
                        <ZoomIn size={16} aria-hidden="true" />
                      </Button>
                    </div>

                    {/* Download */}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Download size={13} aria-hidden="true" />}
                      onClick={handleDownload}
                    >
                      {t("pdf_viewer.download", "Download")}
                    </Button>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};
