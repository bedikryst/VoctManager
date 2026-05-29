/**
 * @file ScrollTopButton.tsx
 * @description Discrete scroll-to-top button — global, available on every page. Appears after
 *  scrolling past 1.5 viewport heights, sits bottom-right as a thin gold hairline with a small
 *  chevron above. Hover/focus reveals the "wróć w ciszę" hint to the left. Uses Lenis if
 *  available for the smooth scroll back (matches the rest of the site's scroll lifecycle),
 *  falls back to native smooth scroll otherwise. Gold (--candle) reads on parchment and dark
 *  alike, so no blend-mode tricks are needed.
 * @architecture Astro islands 2026
 * @module islands/global/ScrollTopButton
 */

import { useCallback, useEffect, useState } from "react";

interface LenisLike {
  scrollTo: (target: number, opts?: { duration?: number }) => void;
}

export function ScrollTopButton(): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf: number | null = null;
    const onScroll = (): void => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        const threshold = window.innerHeight * 1.5;
        setVisible(window.scrollY > threshold);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, []);

  const onClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <button
      type="button"
      className={`scroll-top${visible ? " is-visible" : ""}`}
      aria-label="Wróć na początek strony"
      onClick={onClick}
    >
      <span className="scroll-top-hint" aria-hidden="true">wróć w ciszę</span>
      <span className="scroll-top-mark" aria-hidden="true">
        <svg viewBox="0 0 12 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6 L6 2 L10 6 M6 2 V38" strokeWidth="1" />
        </svg>
      </span>
    </button>
  );
}
