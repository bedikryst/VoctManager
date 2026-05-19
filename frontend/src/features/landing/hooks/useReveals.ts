/**
 * @file useReveals.ts
 * @description IntersectionObserver-driven reveal-on-scroll for any `.reveal` element under root.
 * Adds `is-visible` on intersection and `is-settled` after the transition resolves.
 * Honors `prefers-reduced-motion` by skipping observation and showing all elements immediately.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useReveals
 */

import { useEffect } from "react";

export function useReveals(rootRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current ?? document;
    const items = root.querySelectorAll<HTMLElement>(".reveal");
    if (!items.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((item) => {
        item.classList.add("is-visible", "is-settled");
      });
      return;
    }

    const settle = (el: HTMLElement) => {
      const onEnd = (event: TransitionEvent) => {
        if (event.target !== el) return;
        if (event.propertyName !== "opacity" && event.propertyName !== "transform") return;
        el.classList.add("is-settled");
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
      window.setTimeout(() => {
        el.classList.add("is-settled");
        el.removeEventListener("transitionend", onEnd);
      }, 2400);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("is-visible");
          settle(el);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -12% 0px" },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [rootRef]);
}
