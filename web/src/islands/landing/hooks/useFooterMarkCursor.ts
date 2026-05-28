/**
 * @file useFooterMarkCursor.ts
 * @description Per-letter cursor-reactive variable-font weight for the giant footer
 * wordmark. Splits the element's text into spans on mount, then drives `--wght-add`
 * (0..220) per glyph with an inverse-distance lerp. IntersectionObserver gate ensures
 * mousemove listeners are wired ONLY while the wordmark is in viewport.
 * Desktop fine-pointer only; honors reduced motion.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useFooterMarkCursor
 */

import { useEffect } from "react";

const REACH = 360;
const BOOST = 220;
const LERP = 0.22;
const STILL = 0.5;

export function useFooterMarkCursor(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const markEl = ref.current;
    if (!markEl) return;
    if (!window.matchMedia("(pointer: fine) and (hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (markEl.querySelector(".site-footer-mark-letter")) return;

    const text = markEl.textContent ?? "";
    if (!text) return;
    markEl.textContent = "";
    const letters: HTMLSpanElement[] = [];
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "site-footer-mark-letter";
      span.textContent = ch;
      markEl.appendChild(span);
      letters.push(span);
    }

    const state = new Float32Array(letters.length);
    const rects = new Array<{ cx: number; cy: number }>(letters.length);
    let rectsDirty = true;
    let cursorX = -9999;
    let cursorY = -9999;
    let active = false;
    let raf: number | null = null;

    const measure = () => {
      for (let i = 0; i < letters.length; i++) {
        const r = letters[i].getBoundingClientRect();
        rects[i] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      }
      rectsDirty = false;
    };

    const tick = () => {
      raf = null;
      if (!active) return;
      if (rectsDirty) measure();
      let stillMoving = false;
      for (let i = 0; i < letters.length; i++) {
        const r = rects[i];
        const dx = cursorX - r.cx;
        const dy = cursorY - r.cy;
        const d = Math.hypot(dx, dy);
        const t = d < REACH ? 1 - d / REACH : 0;
        const target = t * t * BOOST;
        const curr = state[i];
        if (target < 0.1 && curr < 0.1) continue;
        const next = curr + (target - curr) * LERP;
        state[i] = next;
        if (Math.abs(target - next) > STILL) stillMoving = true;
        letters[i].style.setProperty("--wght-add", next.toFixed(0));
      }
      if (stillMoving) raf = window.requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      if (raf === null) raf = window.requestAnimationFrame(tick);
    };
    const onViewportChange = () => {
      rectsDirty = true;
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !active) {
            active = true;
            rectsDirty = true;
            window.addEventListener("mousemove", onMove, { passive: true });
            window.addEventListener("scroll", onViewportChange, { passive: true });
            window.addEventListener("resize", onViewportChange);
          } else if (!entry.isIntersecting && active) {
            active = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("scroll", onViewportChange);
            window.removeEventListener("resize", onViewportChange);
            if (raf !== null) {
              window.cancelAnimationFrame(raf);
              raf = null;
            }
            for (let i = 0; i < letters.length; i++) {
              state[i] = 0;
              letters[i].style.removeProperty("--wght-add");
            }
          }
        }
      },
      { rootMargin: "100px" },
    );

    io.observe(markEl);

    return () => {
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [ref]);
}
