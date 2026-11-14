/**
 * @file PdfToolbar.tsx
 * @description The utility pill in the viewer's top-right corner: performance
 * mode, the export controls a document may offer, and at its end whatever the
 * wrapping shell adds (a modal's close). One pill and one row, so nothing
 * stacks a second row of chrome over the top of the page.
 * @module shared/ui/composites/PdfViewer
 */

import type { ReactNode } from "react";
import { Download, Globe, Maximize2, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/primitives/Button";
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

interface PdfToolbarProps {
  /**
   * False while the document loads or has failed: there is nothing to perform
   * or export yet, and only the shell's controls show.
   */
  showDocumentControls: boolean;
  blobUrl: string | null;
  /**
   * When false the export controls (open-in-browser / share / download) are
   * hidden — a protected score is read in-app only. Performance mode stays.
   */
  canExport: boolean;
  supportsNativeShare: boolean;
  isSharing: boolean;
  isDownloading: boolean;
  /** The shell's own controls, last in the pill — see `PdfViewerProps.utilitySlot`. */
  utilitySlot?: ReactNode;
  onOpenInBrowser: () => void;
  onShare: () => void;
  onDownload: () => void;
  onEnterImmersive: () => void;
}

export const PdfToolbar = ({
  showDocumentControls,
  blobUrl,
  canExport,
  supportsNativeShare,
  isSharing,
  isDownloading,
  utilitySlot,
  onOpenInBrowser,
  onShare,
  onDownload,
  onEnterImmersive,
}: PdfToolbarProps) => {
  const { t } = useTranslation();

  if (!showDocumentControls && !utilitySlot) return null;

  // Export controls are withheld for a protected score (in-app only).
  const exportable = showDocumentControls && canExport;

  return (
    <div
      className="absolute right-4 top-4 z-20 flex items-center sm:right-6 sm:top-6"
      data-pdf-gesture-exempt
    >
      <GlassCard
        variant="surface"
        padding="sm"
        className="rounded-full p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        isHoverable={false}
      >
        {/* Single flex-row child: GlassCard's inner wrapper is flex-col, so the
            buttons must share one row container or they stack vertically. */}
        <div className="flex items-center gap-1">
          {/* Spelled out, not a lone glyph: readers were pinch-zooming their way
              through concerts without ever learning this mode existed, and an
              unlabelled expand arrow reads as "zoom", which they already had. */}
          {showDocumentControls && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEnterImmersive}
              leftIcon={<Maximize2 size={16} aria-hidden="true" />}
              aria-label={t("pdf_viewer.immersive_enter", "Performance mode")}
              title={t("pdf_viewer.immersive_enter", "Performance mode")}
              className="h-9 gap-2 rounded-full px-3 text-ink-on-inverse hover:bg-ink-on-inverse/10"
            >
              {t("pdf_viewer.immersive_enter", "Performance mode")}
            </Button>
          )}

          {exportable && blobUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenInBrowser}
              aria-label={t("pdf_viewer.open_browser", "Open in browser")}
              className="h-9 w-9 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
            >
              <Globe size={16} aria-hidden="true" />
            </Button>
          )}

          {exportable && supportsNativeShare && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShare}
              isLoading={isSharing}
              aria-label={t("pdf_viewer.share", "Share")}
              className="h-9 w-9 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
            >
              {!isSharing && <Share2 size={16} aria-hidden="true" />}
            </Button>
          )}

          {exportable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              isLoading={isDownloading}
              aria-label={t("pdf_viewer.download", "Download")}
              className="h-9 w-9 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
            >
              {!isDownloading && <Download size={16} aria-hidden="true" />}
            </Button>
          )}

          {showDocumentControls && utilitySlot && (
            <Divider variant="solid-dark" orientation="vertical" className="mx-0.5 h-5" />
          )}
          {utilitySlot}
        </div>
      </GlassCard>
    </div>
  );
};
