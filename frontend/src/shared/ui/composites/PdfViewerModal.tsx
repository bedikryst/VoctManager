/**
 * @file PdfViewerModal.tsx
 * @description Dialog shell wrapping the headless PdfViewer primitive. Owns Radix Dialog
 * semantics (focus trap, overlay, ARIA), the close affordance, and the "Open full view"
 * link to the deep-linkable DocumentViewerPage when callers provide a typed docType + docId.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewerModal
 */

import React, { useCallback, useEffect, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import {
  PdfViewer,
  type PdfViewerEvent,
} from "@/shared/ui/composites/PdfViewer";
import {
  buildDocumentViewerPath,
  type DocumentDescriptor,
} from "@/pages/app/DocumentViewerPage/types";

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
  /** Stable identity used by the underlying PdfViewer to trigger refetch. */
  docKey?: string | number;
  /**
   * Document descriptor enabling the "Open full view" affordance. When omitted,
   * the link is hidden — the modal still functions as a contextual preview.
   */
  fullView?: DocumentDescriptor;
  /** Telemetry seam forwarded to the underlying PdfViewer. No transport bundled. */
  onEvent?: (event: PdfViewerEvent) => void;
  onClose: () => void;
}

export const PdfViewerModal = ({
  isOpen,
  title,
  subtitle,
  fileName,
  fetchBlob,
  docKey,
  fullView,
  onEvent,
  onClose,
}: PdfViewerModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleFullViewClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Android/iOS hardware-back gesture — close via CloseWatcher when available.
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

  const fullViewSlot = fullView ? (
    <Button
      asChild
      variant="secondary"
      size="sm"
      className="h-11 rounded-2xl px-4 text-ethereal-marble"
    >
      <Link
        to={buildDocumentViewerPath(fullView)}
        state={fullView.hint}
        onClick={handleFullViewClick}
        aria-label={t("pdf_viewer.open_full_view", "Open full view")}
      >
        <ExternalLink size={16} aria-hidden="true" className="mr-2" />
        <span className="hidden sm:inline">
          {t("pdf_viewer.open_full_view", "Open full view")}
        </span>
        <span className="sm:hidden">
          {t("pdf_viewer.open_full_view_short", "Full view")}
        </span>
      </Link>
    </Button>
  ) : null;

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
              <header className="relative z-10 flex items-start gap-3 border-b border-white/10 bg-black/20 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.875rem)] backdrop-blur-xl sm:px-6 sm:pb-4 sm:pt-6">
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
                </div>

                <Button
                  ref={closeButtonRef}
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label={t("common.close_aria", "Close")}
                  className="h-11 w-11 shrink-0 rounded-2xl text-ethereal-marble hover:bg-white/10 hover:text-white"
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </header>

              <PdfViewer
                fetchBlob={fetchBlob}
                docKey={docKey}
                title={title}
                subtitle={subtitle}
                fileName={fileName}
                onEvent={onEvent}
                toolbarSlot={fullViewSlot}
                className="flex-1"
              />
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
};
