/**
 * @file fullscreenSurface.ts
 * @description "Something owns the whole screen right now" — a register, not a
 * scroll lock.
 *
 * A global hotkey has no way to know it is about to open a panel on top of the
 * score stand: the stand is local component state on an unchanged URL, so no
 * route check can see it, and `useBodyScrollLock` is not a proxy for it —
 * `PdfViewerModal` is a `fixed inset-0` surface that never takes that lock,
 * while half the app's ordinary drawers do. The two questions are different and
 * only one of them is "may I open something else".
 *
 * Deliberately not reactive. The only caller is a keydown handler, which asks
 * at the moment of the keystroke; a store with subscriptions would buy
 * re-renders nobody reads. Register only surfaces that fill the viewport AND
 * compute from its width — the score stand and the PDF viewer do both, which is
 * why a panel opening over them is wrong rather than merely untidy.
 * @module shared/lib/dom
 * @architecture Enterprise SaaS 2026
 */

import { useEffect } from "react";

let openFullscreenSurfaces = 0;

/** Registers a viewport-owning surface for as long as it is open. */
export const useFullscreenSurface = (isOpen: boolean): void => {
  useEffect(() => {
    if (!isOpen) return;
    openFullscreenSurfaces += 1;
    return () => {
      openFullscreenSurfaces -= 1;
    };
  }, [isOpen]);
};

export const isFullscreenSurfaceOpen = (): boolean => openFullscreenSurfaces > 0;
