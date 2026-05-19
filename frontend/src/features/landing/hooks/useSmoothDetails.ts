/**
 * @file useSmoothDetails.ts
 * @description Replaces the snap open/close of `<details>` with an animated height
 * transition. Runs as an exclusive accordion within `rootRef`: opening one card
 * closes any sibling that was previously open. On narrow viewports it nudges the
 * summary to ~22% from the top after the open animation completes.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useSmoothDetails
 */

import { useEffect } from "react";

const SELECTOR = ".path-card-detail";
const DURATION_OPEN = 520;
const DURATION_CLOSE = 380;
const EASING = "cubic-bezier(0.22, 0.61, 0.16, 1)";

export function useSmoothDetails(rootRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current ?? document;
    const items = Array.from(root.querySelectorAll<HTMLDetailsElement>(SELECTOR));
    if (!items.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const registry = new Map<HTMLDetailsElement, { close: () => void }>();
    const cleanups: Array<() => void> = [];

    items.forEach((details) => {
      const summary = details.querySelector("summary");
      if (!summary) return;
      const wrap = document.createElement("div");
      wrap.className = "path-card-detail-body";
      while (summary.nextSibling) wrap.appendChild(summary.nextSibling);
      details.appendChild(wrap);

      wrap.style.overflow = "hidden";
      wrap.style.willChange = "height, opacity";
      wrap.style.height = details.open ? "auto" : "0px";
      wrap.style.opacity = details.open ? "1" : "0";

      let animating = false;

      const finish = (toOpen: boolean) => {
        wrap.style.height = toOpen ? "auto" : "0px";
        wrap.style.opacity = toOpen ? "1" : "0";
        if (!toOpen) details.removeAttribute("open");
        animating = false;
      };

      const animate = (toOpen: boolean) => {
        if (reduced) {
          if (toOpen) details.setAttribute("open", "");
          finish(toOpen);
          return;
        }
        animating = true;
        if (toOpen) details.setAttribute("open", "");

        const start = wrap.getBoundingClientRect().height;
        wrap.style.height = `${start}px`;
        wrap.style.opacity = toOpen ? "0" : "1";
        wrap.getBoundingClientRect();

        const targetHeight = toOpen ? wrap.scrollHeight : 0;
        const duration = toOpen ? DURATION_OPEN : DURATION_CLOSE;
        wrap.style.transition = `height ${duration}ms ${EASING}, opacity ${duration}ms ${EASING}`;

        window.requestAnimationFrame(() => {
          wrap.style.height = `${targetHeight}px`;
          wrap.style.opacity = toOpen ? "1" : "0";
        });

        const cleanup = (event: TransitionEvent) => {
          if (event.target !== wrap || event.propertyName !== "height") return;
          wrap.removeEventListener("transitionend", cleanup);
          wrap.style.transition = "";
          finish(toOpen);
        };
        wrap.addEventListener("transitionend", cleanup);
      };

      registry.set(details, {
        close: () => {
          if (details.open && !animating) animate(false);
        },
      });

      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        if (animating) return;
        const toOpen = !details.open;

        const othersOpen = toOpen
          ? Array.from(registry.entries()).filter(([el]) => el !== details && el.open)
          : [];
        if (toOpen) othersOpen.forEach(([, api]) => api.close());

        animate(toOpen);

        if (toOpen && window.matchMedia("(max-width: 980px)").matches) {
          const delay = othersOpen.length > 0 ? 420 : 0;
          window.setTimeout(() => {
            const rect = summary.getBoundingClientRect();
            const targetY = window.scrollY + rect.top - window.innerHeight * 0.22;
            window.scrollTo({ top: targetY, behavior: reduced ? "auto" : "smooth" });
          }, delay);
        }
      };

      summary.addEventListener("click", onClick);
      cleanups.push(() => summary.removeEventListener("click", onClick));
    });

    return () => cleanups.forEach((fn) => fn());
  }, [rootRef]);
}
