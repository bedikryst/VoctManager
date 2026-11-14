/**
 * @file PdfSheet.tsx
 * @description The viewer's one sheet: everything a reader reaches for less
 * often than a page turn, opened from the bottom bar's label. It rises over the
 * page with a scrim, so nothing behind it can be pressed by accident, and holds
 * the viewer's own tab (contents, a page to go to, the fit, the file) beside
 * whatever tabs the host adds (the marks). With one tab it shows no tab row,
 * only the document's name.
 *
 * Escape and the scrim close it; the viewer routes Escape here first while it
 * is open (`PdfViewer`). Sections share one heading style through
 * `PdfSheetSection`, which hosts use for their own sections too.
 * @module shared/ui/composites/PdfViewer
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import { bandButton, bandIconButton } from "../bandChrome";
import type { PdfSheetTab } from "../types";

interface PdfSheetProps {
  /** The viewer's own tab first. */
  tabs: readonly PdfSheetTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Names the sheet for assistive tech, and heads it when it has one tab. */
  title: string;
  onClose: () => void;
}

const SHEET_EASE = [0.16, 1, 0.3, 1] as const;

export const PdfSheet = ({
  tabs,
  activeTab,
  onTabChange,
  title,
  onClose,
}: PdfSheetProps) => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  // Focus moves into the sheet, so a keyboard reader's next Tab is in it and
  // not on a control the scrim now covers.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/50"
        data-pdf-gesture-exempt
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        initial={{ transform: "translateY(100%)" }}
        animate={{ transform: "translateY(0%)" }}
        exit={{ transform: "translateY(100%)" }}
        transition={{ duration: 0.28, ease: SHEET_EASE }}
        className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[85%] w-full max-w-lg flex-col overflow-hidden rounded-t-surface border border-b-0 border-line-on-inverse bg-surface-inverse text-ink-on-inverse outline-none"
        data-pdf-gesture-exempt
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-line-on-inverse px-2 py-1.5">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label={title} className="flex min-w-0 items-center gap-1">
              {tabs.map((tab) => {
                const isActive = tab.id === current.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      bandButton,
                      "px-3",
                      isActive ? "bg-ink-on-inverse/10" : "text-ink-on-inverse/70",
                    )}
                  >
                    <Text as="span" size="base" weight="medium" color="inherit">
                      {tab.label}
                    </Text>
                    {tab.count !== undefined && tab.count > 0 && (
                      <Text as="span" size="sm" color="ink-on-inverse-muted" className="tabular-nums">
                        {tab.count}
                      </Text>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <Text as="p" size="base" weight="medium" color="ink-on-inverse" className="min-w-0 truncate px-3">
              {title}
            </Text>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close_aria", "Zamknij")}
            title={t("common.close_aria", "Zamknij")}
            className={cn(bandIconButton, "ml-auto")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div
          role={tabs.length > 1 ? "tabpanel" : undefined}
          className="ethereal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
        >
          {current.content}
        </div>
      </motion.div>
    </>
  );
};

interface PdfSheetSectionProps {
  title: string;
  /** A control on the heading's line (edit, a count). */
  action?: ReactNode;
  children: ReactNode;
}

/** One section of a sheet tab, the viewer's or a host's. */
export const PdfSheetSection = ({ title, action, children }: PdfSheetSectionProps) => (
  <section className="border-t border-line-on-inverse py-4 first:border-t-0">
    <div className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
      <Text as="p" size="sm" weight="medium" color="ink-on-inverse-muted">
        {title}
      </Text>
      {action}
    </div>
    {children}
  </section>
);
