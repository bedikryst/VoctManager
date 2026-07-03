import { Download, Globe, Maximize2, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

interface PdfToolbarProps {
  blobUrl: string | null;
  /**
   * When false the export controls (open-in-browser / share / download) are
   * hidden — a protected score is read in-app only. Performance mode stays.
   */
  canExport: boolean;
  supportsNativeShare: boolean;
  isSharing: boolean;
  isDownloading: boolean;
  /** Drop the pill one row so it clears a shell-owned top-right control. */
  inset?: boolean;
  onOpenInBrowser: () => void;
  onShare: () => void;
  onDownload: () => void;
  onEnterImmersive: () => void;
}

export const PdfToolbar = ({
  blobUrl,
  canExport,
  supportsNativeShare,
  isSharing,
  isDownloading,
  inset = false,
  onOpenInBrowser,
  onShare,
  onDownload,
  onEnterImmersive,
}: PdfToolbarProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "absolute right-4 z-20 flex items-center sm:right-6",
        inset ? "top-18 sm:top-20" : "top-4 sm:top-6",
      )}
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onEnterImmersive}
            aria-label={t("pdf_viewer.immersive_enter", "Performance mode")}
            title={t("pdf_viewer.immersive_enter", "Performance mode")}
            className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
          >
            <Maximize2 size={16} aria-hidden="true" />
          </Button>

          {/* Export controls are withheld for a protected score (in-app only). */}
          {canExport && blobUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenInBrowser}
              aria-label={t("pdf_viewer.open_browser", "Open in browser")}
              className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              <Globe size={16} aria-hidden="true" />
            </Button>
          )}

          {canExport && supportsNativeShare && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShare}
              isLoading={isSharing}
              aria-label={t("pdf_viewer.share", "Share")}
              className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              {!isSharing && <Share2 size={16} aria-hidden="true" />}
            </Button>
          )}

          {canExport && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              isLoading={isDownloading}
              aria-label={t("pdf_viewer.download", "Download")}
              className="h-9 w-9 rounded-full text-ethereal-marble hover:bg-white/10"
            >
              {!isDownloading && <Download size={16} aria-hidden="true" />}
            </Button>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
