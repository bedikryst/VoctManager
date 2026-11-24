/**
 * @file BulkBar.tsx
 * @description The bar a list shows while rows are selected: what is selected
 * on the left (the count or a hint, then the selection shortcuts), the acts on
 * the selection on the right, the exit last. It portals to the body and stands
 * in the bottom-bar slot above the nav dock (`bottom-dock`).
 *
 * Opaque, on the card's own ground. It floats over rows of text on a plain
 * route, where glass has nothing to show but the row beneath bleeding through
 * the count. The entrance animates the transform as one string, so it runs on
 * the compositor; the caller's `AnimatePresence` plays the exit.
 * @module shared/ui/composites/BulkBar
 */

import React, { type ReactNode } from "react";
import { motion } from "framer-motion";

import { Portal } from "@/shared/lib/dom/Portal";
import { useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import { cn } from "@/shared/lib/utils";

export interface BulkBarProps {
  /** The region's accessible name. */
  readonly label: string;
  /** The left side: the count or a hint, then any selection shortcuts. */
  readonly status: ReactNode;
  /** The right side: the bulk acts, then the exit. */
  readonly actions: ReactNode;
  /** A line under both sides, such as why the acts are unavailable. */
  readonly note?: ReactNode;
  /** `compact` for a status and one act; `wide` (default) for shortcuts or several acts. */
  readonly width?: "compact" | "wide";
}

const WIDTH: Readonly<Record<NonNullable<BulkBarProps["width"]>, string>> = {
  compact: "w-[min(100%-2rem,36rem)]",
  wide: "w-[min(100%-2rem,48rem)]",
};

export function BulkBar({ label, status, actions, note, width = "wide" }: BulkBarProps): React.JSX.Element {
  const slotRef = useBottomBarSlot();

  return (
    <Portal>
      <motion.div
        ref={slotRef}
        initial={{ transform: "translateY(80px)", opacity: 0 }}
        animate={{ transform: "translateY(0px)", opacity: 1 }}
        exit={{ transform: "translateY(80px)", opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed inset-x-0 bottom-dock z-dock-bar mx-auto flex flex-col gap-2 rounded-nested border border-hairline-strong bg-ethereal-alabaster px-4 py-3 shadow-glass-solid",
          WIDTH[width],
        )}
        role="region"
        aria-label={label}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">{status}</div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
        {note}
      </motion.div>
    </Portal>
  );
}
