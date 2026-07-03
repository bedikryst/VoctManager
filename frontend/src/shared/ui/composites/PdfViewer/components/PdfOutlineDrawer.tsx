/**
 * @file PdfOutlineDrawer.tsx
 * @description Left-edge drawer over the viewer listing the document's outline
 * (bookmarks) — for the concert score-book this is the programme: tap a piece,
 * land on its first page. Mirrors the AnnotationSidebar's right-edge collapsed
 * tab so the two drawers read as one design language. The entry covering the
 * current page is highlighted, which doubles as "where am I in the programme".
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, PanelLeftOpen, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import type { PdfOutlineEntry } from "../hooks/usePdfOutline";

interface PdfOutlineDrawerProps {
  entries: PdfOutlineEntry[];
  currentPage: number;
  onJump: (page: number) => void;
}

export const PdfOutlineDrawer = ({
  entries,
  currentPage,
  onJump,
}: PdfOutlineDrawerProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // The entry whose section covers the current page (last start ≤ current).
  const activeIndex = useMemo(() => {
    let active = -1;
    entries.forEach((entry, index) => {
      if (entry.page <= currentPage) active = index;
    });
    return active;
  }, [entries, currentPage]);

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.aside
            key="panel"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto m-3 flex max-h-[calc(100%-7rem)] w-72 flex-col overflow-hidden rounded-3xl border border-white/10 bg-ethereal-ink/85 text-ethereal-marble shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <BookMarked size={15} aria-hidden="true" />
                {t("pdf_viewer.outline_title", "Spis treści")}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close_aria", "Zamknij")}
                className="rounded-full p-1 text-ethereal-marble/70 hover:bg-white/10 hover:text-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <ul className="no-scrollbar flex-1 overflow-y-auto px-2 py-2">
              {entries.map((entry, index) => (
                <li key={`${entry.page}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onJump(entry.page);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                      index === activeIndex
                        ? "bg-ethereal-gold/15 text-ethereal-gold"
                        : "text-ethereal-marble hover:bg-white/10",
                      entry.depth > 0 && "pl-6",
                    )}
                  >
                    <Text
                      as="span"
                      size="xs"
                      className="min-w-0 flex-1 truncate text-inherit"
                    >
                      {entry.title}
                    </Text>
                    <Text
                      as="span"
                      size="xs"
                      className="shrink-0 tabular-nums text-ethereal-marble/50"
                    >
                      {t("pdf_viewer.outline_page", "s. {{page}}", {
                        page: entry.page,
                      })}
                    </Text>
                  </button>
                </li>
              ))}
            </ul>
          </motion.aside>
        ) : (
          <motion.button
            key="tab"
            type="button"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            aria-label={t("pdf_viewer.outline_open", "Pokaż spis treści")}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded-r-2xl border border-l-0 border-white/10 bg-ethereal-ink/80 px-2 py-3 text-ethereal-marble shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:bg-ethereal-ink"
          >
            <PanelLeftOpen size={16} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
