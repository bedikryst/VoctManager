/**
 * @file BottomSheet.tsx
 * @description Mobile-first detail surface. On touch it rises from the bottom
 * edge as a draggable sheet (swipe-down to dismiss); from `sm:` up it presents
 * as a centred modal. Built on the codebase's portal + framer + scroll-lock
 * idiom (matching ConfirmModal) rather than a new dependency, with focus-trap
 * via inert background scroll lock, ESC, and an overlay tap to close.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/BottomSheet
 */

import React, { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Eyebrow, Heading } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Secondary line under the title (project name, date…). */
  subtitle?: string;
  /** A chip/badge rendered inline in the header (e.g. countdown, status). */
  headerBadge?: React.ReactNode;
  /** Surface tone — `dark` keeps the concert's premium dark aesthetic. */
  tone?: "light" | "dark";
  children: React.ReactNode;
  /** Sticky footer (primary actions) pinned above the safe-area inset. */
  footer?: React.ReactNode;
  className?: string;
}

const DISMISS_OFFSET = 110;
const DISMISS_VELOCITY = 600;

export const BottomSheet = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerBadge,
  tone = "light",
  children,
  footer,
  className,
}: BottomSheetProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dragControls = useDragControls();
  const isDark = tone === "dark";

  useBodyScrollLock(isOpen);

  useEffect(() => setMounted(true), []);

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape, isOpen]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      onClose();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-(--z-toast) flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-ethereal-ink/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border shadow-glass-solid",
              "sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl",
              isDark
                ? "border-ethereal-incense/20 bg-ethereal-ink/95 text-ethereal-marble backdrop-blur-ethereal"
                : "border-ethereal-incense/15 bg-ethereal-alabaster text-ethereal-ink",
              className,
            )}
          >
            {/* drag region — the handle + header start the swipe-to-dismiss */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 sm:hidden">
                <span
                  className={cn(
                    "h-1.5 w-11 rounded-full",
                    isDark ? "bg-ethereal-marble/25" : "bg-ethereal-graphite/20",
                  )}
                  aria-hidden="true"
                />
              </div>

              <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
                <div className="min-w-0 flex-1">
                  {subtitle && (
                    <Eyebrow color={isDark ? "parchment-muted" : "muted"} className="mb-1 block truncate">
                      {subtitle}
                    </Eyebrow>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Heading
                      as="h2"
                      id={titleId}
                      size="xl"
                      weight="bold"
                      color={isDark ? "white" : "default"}
                      className="min-w-0 leading-tight"
                    >
                      {title}
                    </Heading>
                    {headerBadge}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={t("common.actions.close", "Zamknij")}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isDark
                      ? "border-ethereal-incense/25 text-ethereal-marble/70 hover:bg-ethereal-incense/15 hover:text-ethereal-marble"
                      : "border-ethereal-incense/20 text-ethereal-graphite/70 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
                  )}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* scrollable body */}
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6",
                !footer && "pb-[max(env(safe-area-inset-bottom),1.5rem)]",
              )}
            >
              {children}
            </div>

            {footer && (
              <div
                className={cn(
                  "shrink-0 border-t px-5 pt-3 sm:px-6",
                  "pb-[max(env(safe-area-inset-bottom),0.85rem)]",
                  isDark
                    ? "border-ethereal-incense/15 bg-ethereal-ink/60"
                    : "border-ethereal-incense/10 bg-ethereal-alabaster/80",
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
