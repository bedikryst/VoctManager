/**
 * @file LocationSheet.tsx
 * @description Tablet/mobile bottom sheet that carries the venue detail over a
 * *visible* full-screen map — the touch counterpart to the desktop rail detail.
 * Deliberately has no backdrop: the conductor keeps seeing the venue (and its 3D
 * dive) in the exposed upper band while reading its data below. A grab handle
 * initiates a drag (so the inner body still scrolls); it snaps between a peek
 * (~42dvh) and an expanded (~88dvh) state, and a downward fling dismisses it.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationSheet
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from "framer-motion";

import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

interface LocationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const SHEET_HEIGHT_RATIO = 0.88;
const PEEK_RATIO = 0.42;

// The entrance starts one viewport below the peek: that distance, as a share of
// the sheet's own height, because a `transform` percentage resolves against it.
const ENTRY_TRANSFORM = `translateY(${(
  ((1 - SHEET_HEIGHT_RATIO + PEEK_RATIO) / SHEET_HEIGHT_RATIO) *
  100
).toFixed(2)}%)`;
const SHEET_SPRING = { type: "spring", damping: 32, stiffness: 320 } as const;
const FLING_VELOCITY = 600;
const DRAG_THRESHOLD = 120;

export const LocationSheet = ({
  isOpen,
  onClose,
  children,
}: LocationSheetProps): React.ReactPortal | null => {
  const dragControls = useDragControls();
  const [expanded, setExpanded] = useState(false);
  const [viewportH, setViewportH] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  useEffect(() => {
    const onResize = (): void => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Every fresh selection opens at the peek height.
  useEffect(() => {
    if (isOpen) setExpanded(false);
  }, [isOpen]);

  // Distance the sheet is pushed down so only the peek band shows.
  const peekY = viewportH * (SHEET_HEIGHT_RATIO - PEEK_RATIO);
  const offscreenY = viewportH;

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ): void => {
    const draggingDown = info.offset.y > DRAG_THRESHOLD || info.velocity.y > FLING_VELOCITY;
    const draggingUp = info.offset.y < -DRAG_THRESHOLD || info.velocity.y < -FLING_VELOCITY;

    if (draggingDown) {
      if (expanded) setExpanded(false);
      else onClose();
    } else if (draggingUp) {
      setExpanded(true);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    // A sheet closed while expanded would otherwise reopen expanded for a frame.
    <AnimatePresence onExitComplete={() => setExpanded(false)}>
      {isOpen && (
        // Entrance and exit ride this wrapper as a `transform` string, on the
        // compositor; the sheet inside keeps `y` for the peek/expand snap and
        // the drag, which an animated `transform` on it would override.
        <motion.div
          key="location-sheet"
          initial={{ transform: ENTRY_TRANSFORM }}
          animate={{ transform: "translateY(0%)" }}
          exit={{ transform: "translateY(100%)" }}
          transition={SHEET_SPRING}
          className="fixed inset-x-0 bottom-0 z-focus-trap lg:hidden"
        >
          <BodyScrollLock />
          {/* Mounts already at the peek: the entrance is the wrapper's alone,
              and `ENTRY_TRANSFORM` is measured from the peek. */}
          <motion.div
            initial={false}
            role="dialog"
            aria-modal="false"
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: offscreenY }}
            dragElastic={0.04}
            animate={{ y: expanded ? 0 : peekY }}
            transition={SHEET_SPRING}
            onDragEnd={handleDragEnd}
            style={{ height: `${SHEET_HEIGHT_RATIO * 100}dvh` }}
            className="flex flex-col rounded-t-3xl border border-ethereal-incense/20 bg-ethereal-alabaster shadow-[0_-18px_48px_var(--glass-shade-lifted)]"
          >
            {/* Grab handle — the only drag-initiating zone, so the body scrolls. */}
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="flex shrink-0 cursor-grab touch-none items-center justify-center pb-1 pt-3 active:cursor-grabbing"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-11 rounded-full bg-ethereal-ink/15"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
