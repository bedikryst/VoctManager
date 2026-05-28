/**
 * @file useFooterMarkBreath.ts
 * @description Scroll-driven variable-font "breath" for the giant footer wordmark — it enters
 *  heavy (540) and settles to 300 as it crosses the viewport, replacing the dead
 *  `--footer-mark-scroll` view-timeline. Writes `--wght-mark` on the mark element; the (split)
 *  letters read it via `calc(var(--wght-mark) + var(--wght-add))`, so this composes cleanly with
 *  the cursor reactivity in useFooterMarkCursor. No-op under reduced motion.
 * @architecture Astro islands 2026
 * @module islands/landing/hooks/useFooterMarkBreath
 */

import { useEffect } from "react";

export function useFooterMarkBreath(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const update = (): void => {
      ticking = false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      let p = (vh - rect.top) / (vh * 0.6);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      el.style.setProperty("--wght-mark", String(Math.round(540 - 240 * p)));
    };
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
}
