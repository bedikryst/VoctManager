/**
 * @file PdfBottomNav.tsx
 * @description Floating reading controls: page, zoom and how the page is fitted
 * to the screen. The fit lives here, next to zoom, because it is the same
 * question asked once instead of pinched at every turn — and it is spelled out
 * in words in its own panel rather than hidden behind another unlabelled glyph.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Rows2,
  Scan,
  Sparkles,
  StretchHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { FitMode, ResolvedFitMode } from "../types";

interface PdfBottomNavProps {
  currentPage: number;
  numPages: number | null;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  /** The reader's choice, `auto` included. */
  fitMode: FitMode;
  /** What `auto` actually resolved to for this screen — drives the icon. */
  resolvedFit: ResolvedFitMode;
  onFitModeChange: (mode: FitMode) => void;
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
}

const FIT_ICONS: Record<ResolvedFitMode, typeof Scan> = {
  page: Scan,
  width: StretchHorizontal,
  half: Rows2,
};

const FIT_OPTIONS: {
  mode: FitMode;
  icon: typeof Scan;
  labelKey: string;
  fallback: string;
}[] = [
  { mode: "auto", icon: Sparkles, labelKey: "pdf_viewer.fit_auto", fallback: "Auto" },
  { mode: "page", icon: Scan, labelKey: "pdf_viewer.fit_page", fallback: "Cała strona" },
  {
    mode: "half",
    icon: Rows2,
    labelKey: "pdf_viewer.fit_half",
    fallback: "Pół strony",
  },
  {
    mode: "width",
    icon: StretchHorizontal,
    labelKey: "pdf_viewer.fit_screen_width",
    fallback: "Szerokość ekranu",
  },
];

export const PdfBottomNav = ({
  currentPage,
  numPages,
  zoom,
  minZoom,
  maxZoom,
  zoomStep,
  fitMode,
  resolvedFit,
  onFitModeChange,
  canTurnBack,
  canTurnForward,
  onTurn,
  onZoomChange,
  onResetZoom,
}: PdfBottomNavProps) => {
  const { t } = useTranslation();
  const zoomPercentage = Math.round(zoom * 100);
  const [isFitPanelOpen, setIsFitPanelOpen] = useState(false);
  const fitAnchorRef = useRef<HTMLDivElement | null>(null);
  const FitIcon = FIT_ICONS[resolvedFit];

  // Dismissal is a document-level listener rather than a full-bleed backdrop
  // element: the pill carries `backdrop-blur`, and a backdrop-filter makes its
  // element a containing block for `position: fixed`, so a "cover the screen"
  // curtain nested inside it covers only the pill. Capture phase, so the panel
  // closes even where the viewer's own gesture layer swallows the event on its
  // way down.
  useEffect(() => {
    if (!isFitPanelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setIsFitPanelOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && fitAnchorRef.current?.contains(target)) return;
      setIsFitPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [isFitPanelOpen]);

  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex justify-center pb-[env(safe-area-inset-bottom)] sm:bottom-8">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface-inverse/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md border border-line-on-inverse"
        data-pdf-gesture-exempt
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onTurn(-1)}
          disabled={!canTurnBack}
          aria-label={t("pdf_viewer.prev_page", "Previous page")}
          className="h-10 w-10 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Button>

        <div className="flex min-w-[4rem] items-center justify-center px-1">
          <Text
            color="ink-on-inverse"
            className="text-xs font-medium tabular-nums tracking-wider"
          >
            {currentPage}{" "}
            <span className="text-ink-on-inverse/40">/ {numPages ?? "?"}</span>
          </Text>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onTurn(1)}
          disabled={!canTurnForward}
          aria-label={t("pdf_viewer.next_page", "Next page")}
          className="h-10 w-10 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Button>

        <Divider variant="solid-dark" orientation="vertical" className="mx-1 h-5" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onZoomChange(-zoomStep)}
          disabled={zoom <= minZoom}
          aria-label={t("pdf_viewer.zoom_out", "Zoom out")}
          className="h-10 w-10 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
        >
          <ZoomOut size={18} aria-hidden="true" />
        </Button>

        <div
          className="flex min-w-[4rem] cursor-pointer items-center justify-center px-1"
          onClick={onResetZoom}
          title={t("pdf_viewer.fit_width", "Fit width")}
        >
          <Text
            color="ink-on-inverse"
            className="text-xs font-medium tabular-nums tracking-wider"
          >
            {zoomPercentage}%
          </Text>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onZoomChange(zoomStep)}
          disabled={zoom >= maxZoom}
          aria-label={t("pdf_viewer.zoom_in", "Zoom in")}
          className="h-10 w-10 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
        >
          <ZoomIn size={18} aria-hidden="true" />
        </Button>

        <Divider variant="solid-dark" orientation="vertical" className="mx-1 h-5" />

        <div className="relative" ref={fitAnchorRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFitPanelOpen((open) => !open)}
            aria-label={t("pdf_viewer.fit_label", "Dopasowanie strony")}
            aria-expanded={isFitPanelOpen}
            title={t("pdf_viewer.fit_label", "Dopasowanie strony")}
            className={cn(
              "h-10 w-10 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10",
              isFitPanelOpen && "bg-ink-on-inverse/15",
            )}
          >
            <FitIcon size={18} aria-hidden="true" />
          </Button>

          <AnimatePresence>
            {isFitPanelOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-full right-0 mb-3 w-52 overflow-hidden rounded-surface border border-line-on-inverse bg-surface-inverse/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              >
                <div className="border-b border-line-on-inverse px-3 py-2">
                  <Eyebrow color="ink-on-inverse-muted">
                    {t("pdf_viewer.fit_label", "Dopasowanie strony")}
                  </Eyebrow>
                </div>
                <ul className="p-1">
                  {FIT_OPTIONS.map(({ mode, icon: Icon, labelKey, fallback }) => {
                    const isActive = fitMode === mode;
                    return (
                      <li key={mode}>
                        <button
                          type="button"
                          onClick={() => {
                            onFitModeChange(mode);
                            setIsFitPanelOpen(false);
                          }}
                          aria-pressed={isActive}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left transition-colors",
                            isActive
                              ? "bg-ethereal-gold/15 text-ethereal-gold"
                              : "text-ink-on-inverse hover:bg-ink-on-inverse/10",
                          )}
                        >
                          <Icon size={15} aria-hidden="true" className="shrink-0" />
                          <Text as="span" size="xs" className="min-w-0 flex-1 text-inherit">
                            {t(labelKey, fallback)}
                          </Text>
                          {mode === "auto" && isActive && (
                            <Text
                              as="span"
                              size="xs"
                              className="shrink-0 text-ethereal-gold/70"
                            >
                              {t(
                                FIT_OPTIONS.find((option) => option.mode === resolvedFit)
                                  ?.labelKey ?? "pdf_viewer.fit_page",
                                "Cała strona",
                              )}
                            </Text>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
