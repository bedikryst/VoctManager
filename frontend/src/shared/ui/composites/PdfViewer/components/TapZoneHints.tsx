/**
 * @file TapZoneHints.tsx
 * @description The turn bands of performance mode, shown instead of explained.
 *
 * Performance mode has no chrome, so nothing on screen says that the outer
 * thirds of the paper turn and the middle leaves. A sentence would be a coach
 * mark, which this app does not do; the bands show themselves instead. With a
 * mouse or stylus, hovering a band draws a faint chevron at that edge of the
 * visible page and a pointer cursor. Where the primary pointer is a finger,
 * there is no hover, so both bands light up once for about a second on
 * entering the mode.
 *
 * Geometry comes from `tapZoneBands`, the same function the tap handler turns
 * with, so the drawn band is the band that turns. The layer never takes a
 * pointer event: it must not intercept the taps it illustrates.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useIsFinePointer } from "@/shared/lib/dom/useMediaQuery";

import { isGestureExemptTarget } from "../hooks/useViewerGestures";
import { resolveTapZone, tapZoneBands, type TapZone } from "../tapZone";

/** How long the touch-only flash holds before it fades (the fade adds ~0.3s). */
const FLASH_HOLD_MS = 750;
const FADE_S = 0.28;

/** A band in px from the viewport's left edge. */
interface BandBox {
  left: number;
  width: number;
}

interface BandBoxes {
  back: BandBox;
  forward: BandBox;
}

const sameBand = (a: BandBox, b: BandBox): boolean =>
  Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5;

interface TapZoneHintsProps {
  /** The scroll container the tap handler measures against. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** The rendered page box — the paper whose outer thirds turn. */
  pageBoxRef: RefObject<HTMLDivElement | null>;
  /** Changes whenever the page box may have been replaced or resized. */
  measureKey: string;
}

export const TapZoneHints = ({
  viewportRef,
  pageBoxRef,
  measureKey,
}: TapZoneHintsProps) => {
  // The PRIMARY pointer decides the flash: a tablet with a trackpad attached
  // still reports some fine pointer, yet its reader turns with a finger and
  // would never hover. Hover itself is read per event, whatever the device.
  const isFinePrimary = useIsFinePointer();
  const reduceMotion = useReducedMotion();
  const [bands, setBands] = useState<BandBoxes | null>(null);
  const [hovered, setHovered] = useState<TapZone>(0);
  // Mounted on entering performance mode, so the flash is decided once, here.
  const [isFlashing, setIsFlashing] = useState(() => !isFinePrimary);

  useEffect(() => {
    if (!isFlashing) return;
    const timer = window.setTimeout(() => setIsFlashing(false), FLASH_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [isFlashing]);

  // The bands follow the visible paper: a re-fit on entering the mode, a zoom,
  // a sideways scroll of a page wider than the screen.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Coalesced to one read per frame: a smooth-scroll turn fires dozens of
    // scroll events, and each would force layout on the turn's hot path.
    let frameId = 0;
    const scheduleMeasure = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        measure();
      });
    };
    const measure = () => {
      const frame = viewport.getBoundingClientRect();
      const page = pageBoxRef.current?.getBoundingClientRect() ?? null;
      const { back, forward } = tapZoneBands(frame, page);
      const next: BandBoxes = {
        back: { left: back.left - frame.left, width: back.right - back.left },
        forward: { left: forward.left - frame.left, width: forward.right - forward.left },
      };
      setBands((current) =>
        current && sameBand(current.back, next.back) && sameBand(current.forward, next.forward)
          ? current
          : next,
      );
    };
    measure();
    viewport.addEventListener("scroll", scheduleMeasure, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(viewport);
    const page = pageBoxRef.current;
    if (page) observer?.observe(page);
    return () => {
      viewport.removeEventListener("scroll", scheduleMeasure);
      observer?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [viewportRef, pageBoxRef, measureKey]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // Over a control or a mark the click belongs to that element, not to the
      // turn, so promising a turn there would be a lie.
      if (isGestureExemptTarget(event.target)) {
        setHovered(0);
        return;
      }
      setHovered(
        resolveTapZone(
          event.clientX,
          viewport.getBoundingClientRect(),
          pageBoxRef.current?.getBoundingClientRect() ?? null,
        ),
      );
    };
    const handleLeave = () => setHovered(0);
    viewport.addEventListener("pointermove", handleMove);
    viewport.addEventListener("pointerleave", handleLeave);
    return () => {
      viewport.removeEventListener("pointermove", handleMove);
      viewport.removeEventListener("pointerleave", handleLeave);
      setHovered(0);
    };
  }, [viewportRef, pageBoxRef]);

  // The cursor belongs to the viewport under the pointer; this layer takes no
  // pointer events and so cannot carry one of its own.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || hovered === 0) return;
    viewport.style.cursor = "pointer";
    return () => {
      viewport.style.cursor = "";
    };
  }, [viewportRef, hovered]);

  if (!bands) return null;

  const transition = { duration: reduceMotion ? 0 : FADE_S, ease: "easeOut" as const };
  const sides = [
    { zone: -1 as const, box: bands.back, Icon: ChevronLeft },
    { zone: 1 as const, box: bands.forward, Icon: ChevronRight },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <AnimatePresence>
        {sides
          .filter(({ zone }) => isFlashing || hovered === zone)
          .map(({ zone, box, Icon }) => (
            <motion.div
              key={zone}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className={cn(
                "absolute inset-y-0 flex items-center",
                zone === -1 ? "justify-start" : "justify-end",
                // Hover names one band with its chevron alone; the flash has to
                // show where each band ends, so it lights the whole band.
                isFlashing &&
                  (zone === -1
                    ? "bg-linear-to-r from-ethereal-gold/15 to-transparent"
                    : "bg-linear-to-l from-ethereal-gold/15 to-transparent"),
              )}
              style={{ left: box.left, width: box.width }}
            >
              <Icon
                size={36}
                strokeWidth={1.5}
                className="mx-2 text-ethereal-gold/70"
                aria-hidden="true"
              />
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
};
