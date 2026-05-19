/**
 * @file useParallax.ts
 * @description rAF-throttled vertical parallax for any `[data-parallax]` element.
 * Each element's `data-parallax` attribute carries its speed multiplier (default 0.15).
 * Disabled under `prefers-reduced-motion: reduce`.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useParallax
 */

import { useEffect } from "react";

export function useParallax(rootRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = rootRef.current ?? document;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    if (!targets.length) return;

    const items = targets.map((el) => ({
      el,
      speed: parseFloat(el.getAttribute("data-parallax") ?? "") || 0.15,
      parent: el.closest("section") ?? el.parentElement,
    }));

    let ticking = false;
    const update = () => {
      const h = window.innerHeight || document.documentElement.clientHeight;
      items.forEach(({ el, speed, parent }) => {
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > h + 200) return;
        const centerOffset = rect.top + rect.height / 2 - h / 2;
        const translate = -centerOffset * speed;
        el.style.transform = `translate3d(0, ${translate.toFixed(2)}px, 0)`;
      });
      ticking = false;
    };

    const onScroll = () => {
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
  }, [rootRef]);
}
