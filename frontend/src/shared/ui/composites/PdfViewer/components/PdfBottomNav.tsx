/**
 * @file PdfBottomNav.tsx
 * @description Floating reading controls: page, zoom and how the page is fitted
 * to the screen. The fit lives here, next to zoom, because it is the same
 * question asked once instead of pinched at every turn — and it is spelled out
 * in words in its own panel rather than hidden behind another unlabelled glyph.
 * The page counter opens the jump panel, so "from page 25" is one gesture
 * rather than twenty-four turns.
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
import { PdfPageJumpPanel } from "./PdfPageJumpPanel";

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
  /** Straight to a page, landing at its top. */
  onJump: (page: number) => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
}

const FIT_ICONS: Record<ResolvedFitMode, typeof Scan> = {
  page: Scan,
  width: StretchHorizontal,
  "two-thirds": Rows2,
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
    mode: "two-thirds",
    icon: Rows2,
    labelKey: "pdf_viewer.fit_two_thirds",
    fallback: "⅔ strony",
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
  onJump,
  onZoomChange,
  onResetZoom,
}: PdfBottomNavProps) => {
  const { t } = useTranslation();
  const zoomPercentage = Math.round(zoom * 100);
  // One panel at a time: both rise from the pill and would stack on each other.
  const [openPanel, setOpenPanel] = useState<"page" | "fit" | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const FitIcon = FIT_ICONS[resolvedFit];
  const canJump = numPages !== null && numPages > 1;
  const togglePanel = (panel: "page" | "fit"): void =>
    setOpenPanel((open) => (open === panel ? null : panel));

  // Dismissal is a document-level listener rather than a full-bleed backdrop
  // element: the pill carries `backdrop-blur`, and a backdrop-filter makes its
  // element a containing block for `position: fixed`, so a "cover the screen"
  // curtain nested inside it covers only the pill. Capture phase, so the panel
  // closes even where the viewer's own gesture layer swallows the event on its
  // way down. A press on the pill itself keeps the panel: the arrows beside an
  // open jump panel are how a near miss on the slider is corrected.
  useEffect(() => {
    if (!openPanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpenPanel(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && pillRef.current?.contains(target)) return;
      setOpenPanel(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [openPanel]);

  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex justify-center pb-[env(safe-area-inset-bottom)] sm:bottom-8">
      <div
        ref={pillRef}
        className="pointer-events-auto relative flex items-center gap-1 rounded-full bg-surface-inverse/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md border border-line-on-inverse"
        data-pdf-gesture-exempt
      >
        {/* Centred on the pill rather than on its trigger: on a phone the
            counter sits near the pill's left end, and a panel wide enough to
            drag through forty pages would hang off the screen there. */}
        <AnimatePresence>
          {openPanel === "page" && numPages !== null && (
            <PdfPageJumpPanel
              currentPage={currentPage}
              numPages={numPages}
              onJump={onJump}
              onClose={() => setOpenPanel(null)}
            />
          )}
        </AnimatePresence>

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

        {/* A faint fill marks the counter as a control: a bare "3 / 40" reads
            as a label, and the jump behind it would never be found. */}
        <button
          type="button"
          onClick={() => togglePanel("page")}
          disabled={!canJump}
          aria-expanded={openPanel === "page"}
          aria-label={t("pdf_viewer.jump_to_page", "Przejdź do strony")}
          title={t("pdf_viewer.jump_to_page", "Przejdź do strony")}
          className={cn(
            "flex h-8 min-w-16 items-center justify-center rounded-full px-2.5 transition-colors",
            canJump && "bg-ink-on-inverse/10 hover:bg-ink-on-inverse/15",
            openPanel === "page" && "bg-ink-on-inverse/20",
          )}
        >
          <Text
            as="span"
            color="ink-on-inverse"
            className="text-xs font-medium tabular-nums tracking-wider"
          >
            {currentPage}{" "}
            <span className="text-ink-on-inverse/40">/ {numPages ?? "?"}</span>
          </Text>
        </button>

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

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => togglePanel("fit")}
            aria-label={t("pdf_viewer.fit_label", "Dopasowanie strony")}
            aria-expanded={openPanel === "fit"}
            title={t("pdf_viewer.fit_label", "Dopasowanie strony")}
            className={cn(
              "h-10 w-10 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10",
              openPanel === "fit" && "bg-ink-on-inverse/15",
            )}
          >
            <FitIcon size={18} aria-hidden="true" />
          </Button>

          <AnimatePresence>
            {openPanel === "fit" && (
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
                            setOpenPanel(null);
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
