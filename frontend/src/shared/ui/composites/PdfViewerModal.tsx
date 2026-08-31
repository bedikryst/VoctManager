/**
 * @file PdfViewerModal.tsx
 * @description Full-bleed dialog shell wrapping the headless PdfViewer primitive.
 * Owns Radix Dialog semantics (focus trap, overlay, ARIA, exit animations) but
 * spends no vertical space on chrome: it fills the viewport edge-to-edge and
 * floats only a self-retiring title label and a round close button — styled to
 * match the viewer's utility pill — so the document gets the whole screen. The
 * "Open full view" link to the deep-linkable DocumentViewerPage rides alongside
 * close when callers provide a typed docType + docId.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewerModal
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import {
  PdfViewer,
  type PdfViewerEvent,
  type PdfPageGeometry,
  type PdfPageApi,
} from "@/shared/ui/composites/PdfViewer";
import {
  buildDocumentViewerPath,
  type DocumentDescriptor,
} from "@/pages/panel/DocumentViewerPage/types";

type CloseWatcherHandle = {
  onclose: (() => void) | null;
  destroy: () => void;
};

type CloseWatcherWindow = Window & {
  CloseWatcher?: new () => CloseWatcherHandle;
};

/**
 * How long the title label stays on screen. It answers "which document is
 * this?" on open and then retires — the top edge belongs to the viewer's own
 * tools (annotation bar on the left, utility pill on the right).
 */
const TITLE_DWELL_MS = 4000;

export interface PdfViewerModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  fileName?: string;
  fetchBlob: (() => Promise<Blob>) | null;
  /** Cache identity of the bytes — see `PdfViewerProps.docKey`. */
  docKey?: string | number;
  /** Server-assembled document, re-rendered on every open — see `PdfViewerProps.volatile`. */
  volatile?: boolean;
  /**
   * The destination path for the "Open full view" affordance. When omitted,
   * the link is hidden — the modal still functions as a contextual preview.
   */
  fullViewHref?: string;
  /** Optional state payload for the full view route. */
  fullViewHint?: unknown;
  /** Typed descriptor for the deep-linkable full document viewer route. */
  fullView?: DocumentDescriptor;
  /** Telemetry seam forwarded to the underlying PdfViewer. No transport bundled. */
  onEvent?: (event: PdfViewerEvent) => void;
  /** Compact controls injected into the floating viewer toolbar (e.g. annotation tools). */
  toolbarSlot?: React.ReactNode;
  /** Layer stacked over each rendered page — see PdfViewer.renderPageOverlay. */
  renderPageOverlay?: (geometry: PdfPageGeometry) => React.ReactNode;
  /** Whole-viewer overlay (annotation index / page rail) — see PdfViewer.overlaySlot. */
  overlaySlot?: React.ReactNode;
  /** Receives the live page handle (current/total + goToPage) on every change. */
  onPageApiChange?: (api: PdfPageApi) => void;
  /**
   * Whether the document may be exported (open/share/download). Forwarded to the
   * viewer; defaults to `true`. Set `false` for a protected, in-app-only score.
   */
  canExport?: boolean;
  /** Which reading habit remembers the fit — see `PdfViewerProps.fitScope`. */
  fitScope?: string;
  onClose: () => void;
}

export const PdfViewerModal = ({
  isOpen,
  title,
  subtitle,
  fileName,
  fetchBlob,
  docKey,
  volatile: isVolatile,
  fullViewHref,
  fullViewHint,
  fullView,
  onEvent,
  toolbarSlot,
  renderPageOverlay,
  overlaySlot,
  onPageApiChange,
  canExport = true,
  fitScope,
  onClose,
}: PdfViewerModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isTitleShown, setIsTitleShown] = useState(true);

  const handleFullViewClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Re-announce whenever a different document is put on the stand.
  useEffect(() => {
    if (!isOpen) return;
    setIsTitleShown(true);
    const timer = window.setTimeout(() => setIsTitleShown(false), TITLE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, docKey, title]);

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

  const resolvedFullViewHref =
    fullViewHref ?? (fullView ? buildDocumentViewerPath(fullView) : undefined);
  const resolvedFullViewHint = fullViewHint ?? fullView?.hint;

  const fullViewSlot = resolvedFullViewHref ? (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
    >
      <Link
        to={resolvedFullViewHref}
        state={resolvedFullViewHint}
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
                // A scrim is the absence of light, not a surface: literal black
                // on both themes, as on `ConfirmModal` / `BottomSheet`. An ink
                // rung here would invert into a white veil over the score.
                className="fixed inset-0 z-focus-trap bg-black/80 backdrop-blur-md"
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
              {/* Full-bleed: no margins, no rounding, no top bar — the viewer owns
                  the whole viewport and the chrome floats on top of it. */}
              <motion.div
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-focus-trap flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-surface-inverse outline-none"
              >
                <PdfViewer
                  fetchBlob={fetchBlob}
                  docKey={docKey}
                  volatile={isVolatile}
                  title={title}
                  subtitle={subtitle}
                  fileName={fileName}
                  onEvent={onEvent}
                  toolbarSlot={toolbarSlot}
                  renderPageOverlay={renderPageOverlay}
                  overlaySlot={overlaySlot}
                  onPageApiChange={onPageApiChange}
                  reserveTopRight
                  canExport={canExport}
                  fitScope={fitScope}
                  className="flex-1"
                />

                {/* Subtle floating title — top-centre, non-interactive, desktop
                    only (the top edge is busy with tools on a phone). Fades out
                    after its dwell so it stops covering the annotation trigger.
                    Never unmounted (on any size, at any opacity) so the dialog
                    keeps the accessible name Radix reads from Dialog.Title. The
                    side padding clears the annotation bar on the left and the
                    utility pill on the right — a tablet-width viewport is
                    narrow enough that a centred max-w-md pill would otherwise
                    reach under them. */}
                <motion.div
                  animate={{ opacity: isTitleShown ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-x-0 top-0 z-focus-trap hidden justify-center px-44 pt-[calc(env(safe-area-inset-top)+0.85rem)] sm:flex"
                >
                  <div className="min-w-0 max-w-md rounded-full border border-line-on-inverse bg-surface-inverse/55 px-4 py-1.5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
                    <Dialog.Title asChild>
                      <Heading as="h2" size="sm" color="ink-on-inverse" className="truncate">
                        {title}
                      </Heading>
                    </Dialog.Title>
                    {subtitle ? (
                      <Dialog.Description asChild>
                        <Text color="ink-on-inverse-muted" className="truncate text-xs">
                          {subtitle}
                        </Text>
                      </Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">
                        {title}
                      </Dialog.Description>
                    )}
                  </div>
                </motion.div>

                {/* Floating close (+ optional full-view), styled to match the
                    viewer's utility pill. The reserveTopRight prop drops that
                    pill one row so the two never overlap. */}
                <div
                  className="absolute right-4 top-4 z-focus-trap sm:right-6 sm:top-6"
                  style={{ paddingTop: "env(safe-area-inset-top)" }}
                >
                  <GlassCard
                    variant="surface"
                    padding="sm"
                    className="rounded-full p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                    isHoverable={false}
                  >
                    <div className="flex items-center gap-1">
                      {fullViewSlot}
                      <Button
                        ref={closeButtonRef}
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        aria-label={t("common.close_aria", "Close")}
                        className="h-9 w-9 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
                      >
                        <X size={18} aria-hidden="true" />
                      </Button>
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};
