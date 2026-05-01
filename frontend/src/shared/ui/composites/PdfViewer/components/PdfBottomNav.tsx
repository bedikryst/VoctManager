import React from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

interface PdfBottomNavProps {
  currentPage: number;
  numPages: number | null;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  onPageChange: (page: number) => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
}

export const PdfBottomNav = ({
  currentPage,
  numPages,
  zoom,
  minZoom,
  maxZoom,
  zoomStep,
  onPageChange,
  onZoomChange,
  onResetZoom,
}: PdfBottomNavProps) => {
  const { t } = useTranslation();
  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex justify-center pb-[env(safe-area-inset-bottom)] sm:bottom-8">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-ethereal-ink/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md border border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label={t("pdf_viewer.prev_page", "Previous page")}
          className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Button>

        <div className="flex min-w-[4rem] items-center justify-center px-1">
          <Text className="text-xs font-medium tabular-nums tracking-wider text-ethereal-marble">
            {currentPage} <span className="text-white/40">/ {numPages ?? "?"}</span>
          </Text>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={numPages === null || currentPage >= numPages}
          aria-label={t("pdf_viewer.next_page", "Next page")}
          className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Button>

        <div className="mx-1 h-5 w-px bg-white/15" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onZoomChange(-zoomStep)}
          disabled={zoom <= minZoom}
          aria-label={t("pdf_viewer.zoom_out", "Zoom out")}
          className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
        >
          <ZoomOut size={18} aria-hidden="true" />
        </Button>

        <div
          className="flex min-w-[4rem] cursor-pointer items-center justify-center px-1 transition-colors hover:text-white"
          onClick={onResetZoom}
          title={t("pdf_viewer.fit_width", "Fit width")}
        >
          <Text className="text-xs font-medium tabular-nums tracking-wider text-ethereal-marble">
            {zoomPercentage}%
          </Text>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onZoomChange(zoomStep)}
          disabled={zoom >= maxZoom}
          aria-label={t("pdf_viewer.zoom_in", "Zoom in")}
          className="h-10 w-10 rounded-full text-ethereal-marble hover:bg-white/10"
        >
          <ZoomIn size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};
