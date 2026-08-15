/**
 * @file useBottomBarSlot.ts
 * @description Occupancy register for the band above the mobile nav dock.
 *
 * Two kinds of surface anchor there and they cannot both win. Contextual bars
 * (save, autosave, bulk actions, the practice player) sit at `bottom-dock` on
 * `z-dock-bar`; the shell's ambient column (offline badge, install prompt, the
 * feedback button) floats a notch higher on a lower layer. On a phone the bars
 * are full-width and 60–130px tall, so "a notch higher" still lands inside them
 * and the column is painted over — invisible, and for the feedback button also
 * unclickable, on every editor screen and throughout practice.
 *
 * Raising the column's z-index would only trade one occlusion for a worse one:
 * an ambient pill over the Save button. So the column yields instead. Each bar
 * reports the height it actually occupies; the shell publishes the tallest as
 * `--dock-bar-h` and the `floating-dock` utility translates clear of it.
 *
 * Heights are measured, not assumed: these bars reflow with their content (an
 * editor bar wraps to two rows on a narrow phone), and a hardcoded clearance
 * would be wrong for half of them the moment one changes.
 * @module shared/lib/dom/useBottomBarSlot
 */

import { useCallback, useEffect, useId, useRef } from "react";
import { create } from "zustand";

interface BottomBarSlotState {
  /** Occupied height in px, keyed by slot id. Absent id = that bar is gone. */
  heights: Record<string, number>;
  occupy: (id: string, height: number) => void;
  release: (id: string) => void;
}

const useBottomBarSlotStore = create<BottomBarSlotState>((set) => ({
  heights: {},

  occupy: (id, height) =>
    set((state) =>
      state.heights[id] === height
        ? state
        : { heights: { ...state.heights, [id]: height } },
    ),

  release: (id) =>
    set((state) => {
      if (!(id in state.heights)) return state;
      const next = { ...state.heights };
      delete next[id];
      return { heights: next };
    }),
}));

/**
 * Attach the returned callback as a bottom bar's `ref`. It measures the element
 * for as long as it is mounted and releases the slot when it unmounts — which,
 * inside `AnimatePresence`, is after the exit animation has finished, so the
 * column comes back down only once the bar is genuinely gone.
 */
export const useBottomBarSlot = (): ((node: HTMLElement | null) => void) => {
  const id = useId();
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      useBottomBarSlotStore.getState().release(id);
    },
    [id],
  );

  return useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node) {
        useBottomBarSlotStore.getState().release(id);
        return;
      }

      const { occupy } = useBottomBarSlotStore.getState();
      occupy(id, node.offsetHeight);

      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(([entry]) => {
        // borderBoxSize over contentRect: the bars carry padding and a border,
        // and it is the painted box the column has to clear.
        const height =
          entry?.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
        occupy(id, Math.round(height));
      });
      observer.observe(node);
      observerRef.current = observer;
    },
    [id],
  );
};

/** Height of the tallest bar currently in the band, 0 when it is free. */
export const useBottomBarHeight = (): number =>
  useBottomBarSlotStore((state) => {
    const heights = Object.values(state.heights);
    return heights.length === 0 ? 0 : Math.max(...heights);
  });
