/**
 * @file PdfViewerModal.tsx
 * @description Dialog shell wrapping the headless PdfViewer primitive. Owns Radix Dialog
 * semantics (focus trap, overlay, ARIA, exit animations), the close affordance, and the "Open full view"
 * link to the deep-linkable DocumentViewerPage when callers provide a typed docType + docId.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewerModal
 */

import React, { useCallback, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import {
  PdfViewer,
  type PdfViewerEvent,
} from "@/shared/ui/composites/PdfViewer";

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
   * The destination path for the "Open full view" affordance. When omitted,
   * the link is hidden — the modal still functions as a contextual preview.
   */
  fullViewHref?: string;
  /** Optional state payload for the full view route. */
  fullViewHint?: unknown;
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
  fullViewHref,
  fullViewHint,
  onEvent,
  onClose,
}: PdfViewerModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleFullViewClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Android/iOS hardware-back gesture — close via CloseWatcher when available.
  useEffect(() => {
    if (!isOpen) return;

    const closeWatcherWindow = window as CloseWatcherWindow;
    if (!closeWatcherWindow.CloseWatcher) return;

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

  const fullViewSlot = fullViewHref ? (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10 hover:text-white"
    >
      <Link
        to={fullViewHref}
        state={fullViewHint}
        onClick={handleFullViewClick}
        aria-label={t("pdf_viewer.open_full_view", "Open full view")}
      >
        <ExternalLink size={18} aria-hidden="true" />
      </Link>
    </Button>
  ) : null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-focus-trap bg-ethereal-ink/80 backdrop-blur-md"
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              forceMount
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                closeButtonRef.current?.focus();
              }}
            >
              <div className="fixed inset-0 z-focus-trap flex flex-col items-center justify-center outline-none sm:p-6 md:p-12 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.96 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="pointer-events-auto relative flex h-full w-full max-w-7xl flex-col overflow-hidden bg-ethereal-ink shadow-glass-ethereal sm:max-h-full sm:rounded-[2rem] sm:border sm:border-white/10"
                >
                  <div className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-white/[0.02] px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl sm:px-6 sm:py-4">
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                      <Dialog.Title asChild>
                        <Heading as="h2" size="sm" className="truncate text-ethereal-marble">
                          {title}
                        </Heading>
                      </Dialog.Title>
                      {subtitle ? (
                        <Dialog.Description asChild>
                          <Text color="parchment-muted" className="truncate text-xs">
                            {subtitle}
                          </Text>
                        </Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">
                          {title}
                        </Dialog.Description>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                      {fullViewSlot}
                      {fullViewSlot && <div className="mx-1 h-6 w-px bg-white/10" />}
                      <Button
                        ref={closeButtonRef}
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        aria-label={t("common.close_aria", "Close")}
                        className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10 hover:text-white"
                      >
                        <X size={20} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <PdfViewer
                    fetchBlob={fetchBlob}
                    docKey={docKey}
                    title={title}
                    subtitle={subtitle}
                    fileName={fileName}
                    onEvent={onEvent}
                    className="flex-1"
                  />
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};