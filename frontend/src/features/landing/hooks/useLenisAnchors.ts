/**
 * @file useLenisAnchors.ts
 * @description Intercepts in-document anchor clicks (a[href^="#"]) and routes them through
 * Lenis for buttery smooth-scroll. No-op for clicks with modifiers or for elements
 * that explicitly opt out via `data-no-lenis`. Returns nothing — purely side-effectful.
 *
 * Note: the underlying Lenis instance is created by `<ReactLenis root>` in HomePage.tsx.
 * We obtain it via `useLenis()` from the same library to avoid creating a duplicate.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useLenisAnchors
 */

import { useEffect } from "react";
import { useLenis } from "lenis/react";

const ANCHOR_OFFSET = -80;

export function useLenisAnchors(): void {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor) return;
      if (anchor.dataset.noLenis !== undefined) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const dest = document.querySelector(href);
      if (!dest) return;
      event.preventDefault();
      lenis.scrollTo(dest as HTMLElement, { offset: ANCHOR_OFFSET });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lenis]);
}
