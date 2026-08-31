/**
 * @file ScoreProgramBar.tsx
 * @description The concert binder's own navigation: which piece the reader is
 * standing in, and the two moves that matter on a stand — the piece before and
 * the piece after. Page-by-page turning already exists and is the wrong unit
 * when the conductor says "od Gloria": nobody counts pages to get there.
 *
 * The programme it lists is the production's, in the production's order. There
 * is deliberately no way to reorder it here — the running order of a concert is
 * data the whole choir shares (edited on the Program tab, and the book is bound
 * in that order), and a second, private truth about what comes next is exactly
 * the thing that goes wrong on a stage.
 *
 * Hidden in performance mode, where the score owns the glass.
 * @module features/annotations/components
 */

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ListMusic } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { usePdfImmersive } from "@/shared/ui/composites/PdfViewer";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { itemAtPage, pieceJumpTarget, type ScoreBook } from "../lib/scoreBook";

interface ScoreProgramBarProps {
  book: ScoreBook;
  currentPage: number;
  goToPage: (page: number) => void;
}

export const ScoreProgramBar = ({
  book,
  currentPage,
  goToPage,
}: ScoreProgramBarProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const isImmersive = usePdfImmersive();
  const [isListOpen, setIsListOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  // Dismissal on a press anywhere else, in capture phase so the viewer's
  // gesture layer cannot swallow it first. A full-bleed backdrop element is not
  // an option here: this pill carries `backdrop-blur`, which makes it the
  // containing block for any `position: fixed` child.
  useEffect(() => {
    if (!isListOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && anchorRef.current?.contains(target)) return;
      setIsListOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setIsListOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isListOpen]);

  if (isImmersive || book.items.length === 0) return null;

  const current = itemAtPage(book, currentPage);
  const previousPage = pieceJumpTarget(book, currentPage, -1);
  const nextPage = pieceJumpTarget(book, currentPage, 1);
  const position = current
    ? book.items.findIndex((item) => item.id === current.id) + 1
    : 0;

  return (
    // Sits clear of the reading controls below it; `bottom-dock` is for the
    // app's nav dock, which a full-bleed viewer has already covered.
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 sm:bottom-28">
      <div
        ref={anchorRef}
        className="pointer-events-auto relative flex max-w-full items-center gap-1 rounded-full border border-line-on-inverse bg-surface-inverse/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
        data-pdf-gesture-exempt
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => previousPage !== null && goToPage(previousPage)}
          disabled={previousPage === null}
          aria-label={t("score_book.piece_prev", "Poprzedni utwór")}
          className="h-9 w-9 shrink-0 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </Button>

        <button
          type="button"
          onClick={() => setIsListOpen((open) => !open)}
          aria-expanded={isListOpen}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-full px-3 py-1 transition-colors hover:bg-ink-on-inverse/10",
            isListOpen && "bg-ink-on-inverse/15",
          )}
        >
          <ListMusic
            size={14}
            aria-hidden="true"
            className="shrink-0 text-ethereal-gold"
          />
          <span className="min-w-0 text-left">
            <Text
              as="span"
              size="xs"
              className="block truncate font-medium text-ink-on-inverse"
            >
              {current
                ? current.title
                : t("score_book.front_matter", "Początek książki")}
            </Text>
            {current && (
              <Eyebrow as="span" color="ink-on-inverse-muted" className="block truncate">
                {[current.composer, `${position}/${book.items.length}`]
                  .filter(Boolean)
                  .join(" · ")}
              </Eyebrow>
            )}
          </span>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => nextPage !== null && goToPage(nextPage)}
          disabled={nextPage === null}
          aria-label={t("score_book.piece_next", "Następny utwór")}
          className="h-9 w-9 shrink-0 rounded-full text-ink-on-inverse hover:bg-ink-on-inverse/10"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </Button>

        <AnimatePresence>
          {isListOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-full left-1/2 mb-3 flex max-h-[50vh] w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-surface border border-line-on-inverse bg-surface-inverse/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            >
              <div className="shrink-0 border-b border-line-on-inverse px-3 py-2">
                <Eyebrow color="ink-on-inverse-muted">
                  {t("score_book.programme", "Program koncertu")}
                </Eyebrow>
              </div>
              <ul className="ethereal-scroll min-h-0 flex-1 overflow-y-auto p-1">
                {book.items.map((item, index) => {
                  const isActive = current?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          goToPage(item.first_page);
                          setIsListOpen(false);
                        }}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left transition-colors",
                          isActive
                            ? "bg-ethereal-gold/15 text-ethereal-gold"
                            : "text-ink-on-inverse hover:bg-ink-on-inverse/10",
                        )}
                      >
                        <Eyebrow
                          as="span"
                          color={isActive ? "gold" : "ink-on-inverse-muted"}
                          className="w-5 shrink-0 text-right lining-nums"
                        >
                          {index + 1}
                        </Eyebrow>
                        <span className="min-w-0 flex-1">
                          <Text
                            as="span"
                            size="xs"
                            className="block truncate text-inherit"
                          >
                            {item.title}
                          </Text>
                          {item.composer && (
                            <Eyebrow
                              as="span"
                              color="ink-on-inverse-muted"
                              className="block truncate"
                            >
                              {item.composer}
                            </Eyebrow>
                          )}
                        </span>
                        {item.is_encore && (
                          <Eyebrow as="span" color="ink-on-inverse-muted" className="shrink-0">
                            {t("score_book.encore", "Bis")}
                          </Eyebrow>
                        )}
                        <Eyebrow
                          as="span"
                          color={isActive ? "gold" : "ink-on-inverse-muted"}
                          className="shrink-0 lining-nums"
                        >
                          {t("pdf_viewer.outline_page", "s. {{page}}", {
                            page: item.first_page,
                          })}
                        </Eyebrow>
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
  );
};
