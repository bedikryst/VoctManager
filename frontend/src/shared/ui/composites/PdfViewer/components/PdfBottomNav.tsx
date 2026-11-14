/**
 * @file PdfBottomNav.tsx
 * @description The viewer's bottom band: page turns around one label that
 * answers "where am I" in the words the room uses — the host's name for the
 * place ("2 · Locus iste") and the printed page ("s. 1"). Tapping the label
 * opens the sheet, where jumps, the fit and everything else live. Zoom buttons
 * are offered only to a fine pointer: touch has pinch, and two glyphs a finger
 * never needs were weight on every phone.
 * @module shared/ui/composites/PdfViewer
 */

import { ChevronLeft, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import { bandButton, bandIconButton } from "../bandChrome";
import { pageLabelText, type PageLabelling } from "../pageLabels";

interface PdfBottomNavProps {
  currentPage: number;
  numPages: number | null;
  /** Printed page numbers, when the document has its own. */
  labelling: PageLabelling | null;
  /** The host's name for where the current page sits, if it has one. */
  place: string | null;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  /** Is there anything above / below, be it a page or another screenful of one? */
  canTurnBack: boolean;
  canTurnForward: boolean;
  /**
   * One reader's turn. NOT "go to page ± 1": where the page is taller than the
   * screen the turn is a screenful, and a control that jumped the whole page
   * would step over the half nobody has read yet.
   */
  onTurn: (delta: 1 | -1) => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  isSheetOpen: boolean;
  onOpenSheet: () => void;
}

export const PdfBottomNav = ({
  currentPage,
  numPages,
  labelling,
  place,
  zoom,
  minZoom,
  maxZoom,
  zoomStep,
  canTurnBack,
  canTurnForward,
  onTurn,
  onZoomChange,
  onResetZoom,
  isSheetOpen,
  onOpenSheet,
}: PdfBottomNavProps) => {
  const { t } = useTranslation();
  const pageText = labelling
    ? pageLabelText(t, labelling, currentPage)
    : `${currentPage} / ${numPages ?? "?"}`;

  return (
    // Three columns, so the label stays centred whether or not the zoom group
    // stands at the right; the side columns give way first on a narrow screen.
    <div
      className="grid h-full grid-cols-[1fr_minmax(0,auto)_1fr] items-center px-2 sm:px-4"
      data-pdf-gesture-exempt
    >
      <div aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => onTurn(-1)}
          disabled={!canTurnBack}
          aria-label={t("pdf_viewer.prev_page", "Previous page")}
          title={t("pdf_viewer.prev_page", "Previous page")}
          className={bandIconButton}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenSheet}
          aria-haspopup="dialog"
          aria-expanded={isSheetOpen}
          title={t("pdf_viewer.sheet_open", "Spis, strony i ustawienia")}
          className={cn(bandButton, "min-w-0 px-3", isSheetOpen && "bg-ink-on-inverse/10")}
        >
          {place && (
            <Text as="span" size="base" weight="medium" color="inherit" className="min-w-0 truncate">
              {place}
            </Text>
          )}
          {place && (
            <Text as="span" size="base" color="ink-on-inverse-muted" className="shrink-0" aria-hidden="true">
              ·
            </Text>
          )}
          <Text
            as="span"
            size="base"
            weight={place ? "normal" : "medium"}
            color={place ? "ink-on-inverse-muted" : "inherit"}
            className="shrink-0 whitespace-nowrap tabular-nums"
          >
            {pageText}
          </Text>
          <ChevronUp size={16} aria-hidden="true" className="shrink-0 opacity-60" />
        </button>

        <button
          type="button"
          onClick={() => onTurn(1)}
          disabled={!canTurnForward}
          aria-label={t("pdf_viewer.next_page", "Next page")}
          title={t("pdf_viewer.next_page", "Next page")}
          className={bandIconButton}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="hidden items-center justify-end gap-0.5 pointer-fine:flex">
        <button
          type="button"
          onClick={() => onZoomChange(-zoomStep)}
          disabled={zoom <= minZoom}
          aria-label={t("pdf_viewer.zoom_out", "Zoom out")}
          title={t("pdf_viewer.zoom_out", "Zoom out")}
          className={bandIconButton}
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onResetZoom}
          title={t("pdf_viewer.zoom_reset", "Wróć do dopasowanego rozmiaru")}
          className={cn(bandButton, "min-w-14 px-2")}
        >
          <Text as="span" size="sm" weight="medium" color="inherit" className="tabular-nums">
            {Math.round(zoom * 100)}%
          </Text>
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(zoomStep)}
          disabled={zoom >= maxZoom}
          aria-label={t("pdf_viewer.zoom_in", "Zoom in")}
          title={t("pdf_viewer.zoom_in", "Zoom in")}
          className={bandIconButton}
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
