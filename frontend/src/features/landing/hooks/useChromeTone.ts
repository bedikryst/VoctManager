/**
 * @file useChromeTone.ts
 * @description Adaptive header tint: probes the element under the chrome's bottom edge
 * and toggles `is-on-dark` so the glass header switches between paper / dark surfaces.
 * Couples with the hero IntersectionObserver to add `is-active` once the hero scrolls
 * past — that's the moment the chrome transitions into glass mode.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useChromeTone
 */

import { useEffect } from "react";

const DARK_SELECTORS =
  ".hero, .image-rite, .ensemble, .final-support, .threshold, .vault, .regulamin, .gratitude, .failure";

export function useChromeTone(
  chromeRef: React.RefObject<HTMLElement | null>,
  heroRef: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome) return;

    let pending = false;

    const update = () => {
      pending = false;
      const rect = chrome.getBoundingClientRect();
      const probeY = Math.round(rect.bottom) + 8;
      const probeX = Math.round(window.innerWidth / 2);
      if (probeY <= 0 || probeY >= window.innerHeight) return;
      const el = document.elementFromPoint(probeX, probeY);
      if (!el) return;
      const isDark = Boolean(el.closest(DARK_SELECTORS));
      chrome.classList.toggle("is-on-dark", isDark);
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(update);
    };

    let heroObserver: IntersectionObserver | null = null;
    const hero = heroRef.current;
    if (hero) {
      heroObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const active = entry.intersectionRatio < 0.08;
            chrome.classList.toggle("is-active", active);
          });
        },
        { threshold: [0, 0.08, 0.5, 1] },
      );
      heroObserver.observe(hero);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    const timers = [
      window.setTimeout(update, 1200),
      window.setTimeout(update, 4600),
    ];

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      heroObserver?.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [chromeRef, heroRef]);
}
