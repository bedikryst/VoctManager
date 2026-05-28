/**
 * @file useLenisLock.ts
 * @description Stops/starts the shared (vanilla) Lenis instance — exposed on `window.__lenis`
 *  by BaseLayout — while a modal is open, so background scroll doesn't propagate behind it.
 *  Replaces the SPA's `useLenis()` from `lenis/react` (there is no <ReactLenis> provider in the
 *  Astro islands; Lenis is mounted once, framework-agnostically, in the layout). No-op when
 *  Lenis isn't running (coarse pointer / reduced motion); always restarts on cleanup.
 * @architecture Astro islands 2026
 * @module islands/landing/hooks/useLenisLock
 */

import { useEffect } from "react";

interface LenisLike {
  stop: () => void;
  start: () => void;
}

export function useLenisLock(active: boolean): void {
  useEffect(() => {
    const lenis = (window as Window & { __lenis?: LenisLike }).__lenis;
    if (!lenis) return;
    if (active) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [active]);
}
