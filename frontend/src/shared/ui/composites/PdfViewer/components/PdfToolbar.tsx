import { Download, Globe, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

interface PdfToolbarProps {
  blobUrl: string | null;
  supportsNativeShare: boolean;
  isSharing: boolean;
  isDownloading: boolean;
  onOpenInBrowser: () => void;
  onShare: () => void;
  onDownload: () => void;
}

export const PdfToolbar = ({
  blobUrl,
  supportsNativeShare,
  isSharing,
  isDownloading,
  onOpenInBrowser,
  onShare,
  onDownload,
}: PdfToolbarProps) => {
  const { t } = useTranslation();

  return (
    <div className="absolute right-4 top-4 z-20 flex items-center sm:right-6 sm:top-6">
      <GlassCard
        variant="surface"
        padding="sm"
        className="rounded-full p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        isHoverable={false}
      >
        {/* Single flex-row child: GlassCard's inner wrapper is flex-col, so the
            buttons must share one row container or they stack vertically. */}
        <div className="flex items-center gap-1">
          {blobUrl && (
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

          {supportsNativeShare && (
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
        </div>
      </GlassCard>
    </div>
  );
};
