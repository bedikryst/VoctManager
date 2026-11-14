/**
 * @file PdfViewerModal.tsx
 * @description Full-bleed dialog shell wrapping the headless PdfViewer primitive.
 * Owns Radix Dialog semantics (focus trap, overlay, ARIA, exit animations) but
 * adds no chrome of its own: it fills the viewport edge-to-edge, puts its close
 * at the end of the viewer's top band, and shows a self-retiring title in the
 * middle of that band. The "Open full view" link to the deep-linkable
 * DocumentViewerPage rides beside close only where a caller passes a full
 * view: the manager's hub does, and nothing a singer opens does.
 * @module shared/ui/composites/PdfViewerModal
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useFullscreenSurface } from "@/shared/lib/dom/fullscreenSurface";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import {
  PdfViewer,
  bandIconButton,
  type PdfViewerEvent,
  type PdfPageGeometry,
  type PdfPageApi,
  type PdfPageLabel,
  type PdfToolLayout,
  type FitMode,
  type PdfContentsEntry,
  type PdfSheetTab,
} from "@/shared/ui/composites/PdfViewer";
import {
  buildDocumentViewerPath,
  type DocumentDescriptor,
} from "@/shared/lib/navigation/documentViewerRoute";

type CloseWatcherHandle = {
  onclose: (() => void) | null;
  destroy: () => void;
};

type CloseWatcherWindow = Window & {
  CloseWatcher?: new () => CloseWatcherHandle;
};

/**
 * How long the title label stays on screen. It answers "which document is
 * this?" on open and then retires — the top band belongs to the viewer's own
 * tools (annotation bar on the left, utility controls on the right).
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
  /** Layer over the viewer and all its chrome (a guide) — see PdfViewer.modalSlot. */
  modalSlot?: React.ReactNode;
  /** Receives the live page handle (current/total + goToPage) on every change. */
  onPageApiChange?: (api: PdfPageApi) => void;
  /** An interactive overlay's first claim on a key — see `PdfViewerProps.claimKey`. */
  claimKey?: (event: KeyboardEvent) => boolean;
  /** Whether the tool slot may become a rail — see `PdfViewerProps.toolLayout`. */
  toolLayout?: PdfToolLayout;
  /**
   * Whether the document may be exported (open/share/download). Forwarded to the
   * viewer; defaults to `true`. Set `false` for a protected, in-app-only score.
   */
  canExport?: boolean;
  /** Which reading habit remembers the fit — see `PdfViewerProps.fitScope`. */
  fitScope?: string;
  /** Fit the document requires — see `PdfViewerProps.preferredFit`. */
  preferredFit?: FitMode;
  /** Printed page numbers — see `PdfViewerProps.pageLabels`. */
  pageLabels?: readonly PdfPageLabel[];
  /** The document's contents in the host's words — see `PdfViewerProps.contents`. */
  contents?: readonly PdfContentsEntry[];
  contentsTitle?: string;
  /** Where a page sits, for the bottom bar — see `PdfViewerProps.describePage`. */
  describePage?: (page: number) => string | null;
  /** The host's section in the sheet — see `PdfViewerProps.sheetSection`. */
  sheetSection?: React.ReactNode;
  /** Further tabs of the sheet — see `PdfViewerProps.sheetTabs`. */
  sheetTabs?: readonly PdfSheetTab[];
  mainTabLabel?: string;
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
  modalSlot,
  onPageApiChange,
  claimKey,
  toolLayout,
  canExport = true,
  fitScope,
  preferredFit,
  pageLabels,
  contents,
  contentsTitle,
  describePage,
  sheetSection,
  sheetTabs,
  mainTabLabel,
  onClose,
}: PdfViewerModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isTitleShown, setIsTitleShown] = useState(true);

  // This surface fills the viewport and computes its fit from the real viewport
  // width, so a global hotkey must not open a panel on top of it. Registering
  // is all it does — no scroll lock, no behaviour change.
  useFullscreenSurface(isOpen);

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

  // The system back gesture (Android, via CloseWatcher where available) is
  // Escape first: an overlay that claims Escape winds down its own state, and
  // only an unclaimed back closes the document. A watcher that has fired is
  // spent, so a claimed back arms the next one.
  const escapeRef = useRef(claimKey);
  escapeRef.current = claimKey;
  const [backArmed, setBackArmed] = useState(0);
  useEffect(() => {
    if (!isOpen) return;

    const closeWatcherWindow = window as CloseWatcherWindow;
    if (!closeWatcherWindow.CloseWatcher) return;

    const watcher = new closeWatcherWindow.CloseWatcher();
    watcher.onclose = () => {
      const claimed =
        escapeRef.current?.(new KeyboardEvent("keydown", { key: "Escape" })) ?? false;
      if (claimed) setBackArmed((count) => count + 1);
      else onClose();
    };

    return () => {
      try {
        watcher.destroy();
      } catch {
        // CloseWatcher implementations may throw when already released.
      }
    };
  }, [isOpen, onClose, backArmed]);

  const resolvedFullViewHref =
    fullViewHref ?? (fullView ? buildDocumentViewerPath(fullView) : undefined);
  const resolvedFullViewHint = fullViewHint ?? fullView?.hint;

  const utilitySlot = (
    <>
      {resolvedFullViewHref && (
        <Link
          to={resolvedFullViewHref}
          state={resolvedFullViewHint}
          onClick={handleFullViewClick}
          aria-label={t("pdf_viewer.open_full_view", "Open full view")}
          title={t("pdf_viewer.open_full_view", "Open full view")}
          className={bandIconButton}
        >
          <ExternalLink size={18} aria-hidden="true" />
        </Link>
      )}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label={t("common.close_aria", "Close")}
        title={t("common.close_aria", "Close")}
        className={bandIconButton}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </>
  );

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
                initial={{ opacity: 0, transform: "scale(0.99)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                exit={{ opacity: 0, transform: "scale(0.99)" }}
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
                  modalSlot={modalSlot}
                  onPageApiChange={onPageApiChange}
                  claimKey={claimKey}
                  toolLayout={toolLayout}
                  utilitySlot={utilitySlot}
                  pageLabels={pageLabels}
                  contents={contents}
                  contentsTitle={contentsTitle}
                  describePage={describePage}
                  sheetSection={sheetSection}
                  sheetTabs={sheetTabs}
                  mainTabLabel={mainTabLabel}
                  canExport={canExport}
                  fitScope={fitScope}
                  preferredFit={preferredFit}
                  className="flex-1"
                />

                {/* The title, in the middle of the top band — non-interactive,
                    desktop only (a phone's band is full with its tools). Fades
                    out after its dwell. Never unmounted (on any size, at any
                    opacity) so the dialog keeps the accessible name Radix
                    reads from Dialog.Title. The side padding clears the
                    annotation trigger on the left and the utility controls on
                    the right. */}
                <motion.div
                  animate={{ opacity: isTitleShown ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-x-0 top-0 z-focus-trap hidden h-12 items-center justify-center px-56 sm:flex"
                >
                  <div className="min-w-0 max-w-md text-center">
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
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};
