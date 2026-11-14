/**
 * @file PdfToolbar.tsx
 * @description The right end of the viewer's top band: performance mode, the
 * export controls a document may offer, and at its end whatever the wrapping
 * shell adds (a modal's close). Flat controls in a band reserved above the
 * page, so nothing here ever lies over the music. Below the `sm` width the
 * export icons give way to the label and close, and the sheet's file section
 * carries them instead.
 * @module shared/ui/composites/PdfViewer
 */

import type { ReactNode } from "react";
import { Download, Globe, Loader2, Maximize2, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { bandButton, bandIconButton } from "../bandChrome";

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
  /** The shell's own controls, last in the band — see `PdfViewerProps.utilitySlot`. */
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
      className="absolute right-2 top-1 z-20 flex items-center gap-0.5 sm:right-4"
      data-pdf-gesture-exempt
    >
      {/* Spelled out, not a lone glyph: readers were pinch-zooming their way
          through concerts without ever learning this mode existed, and an
          unlabelled expand arrow reads as "zoom", which they already had. */}
      {showDocumentControls && (
        <button
          type="button"
          onClick={onEnterImmersive}
          title={t("pdf_viewer.immersive_enter", "Performance mode")}
          className={cn(bandButton, "px-3")}
        >
          <Maximize2 size={18} aria-hidden="true" />
          <Text as="span" size="base" weight="medium" color="inherit" className="whitespace-nowrap">
            {t("pdf_viewer.immersive_enter", "Performance mode")}
          </Text>
        </button>
      )}

      {exportable && (
        <div className="hidden items-center gap-0.5 sm:flex">
          {blobUrl && (
            <button
              type="button"
              onClick={onOpenInBrowser}
              aria-label={t("pdf_viewer.open_browser", "Open in browser")}
              title={t("pdf_viewer.open_browser", "Open in browser")}
              className={bandIconButton}
            >
              <Globe size={18} aria-hidden="true" />
            </button>
          )}
          {supportsNativeShare && (
            <button
              type="button"
              onClick={onShare}
              disabled={isSharing}
              aria-label={t("pdf_viewer.share", "Share")}
              title={t("pdf_viewer.share", "Share")}
              className={bandIconButton}
            >
              {isSharing ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <Share2 size={18} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            aria-label={t("pdf_viewer.download", "Download")}
            title={t("pdf_viewer.download", "Download")}
            className={bandIconButton}
          >
            {isDownloading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Download size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {showDocumentControls && utilitySlot && (
        <Divider variant="solid-dark" orientation="vertical" className="mx-1 h-5" />
      )}
      {utilitySlot}
    </div>
  );
};
