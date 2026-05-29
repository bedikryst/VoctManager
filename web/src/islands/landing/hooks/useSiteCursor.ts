/**
 * @file useSiteCursor.ts
 * @description Custom site cursor with lerp easing + magnetic snap + click feedback.
 *
 *  Awwwards-grade refinements layered onto the original lerp follower:
 *   • Magnetic snap (15% weight) — over interactive elements the target nudges toward the
 *     element's centre, so the cursor settles ON the link/button instead of next to it.
 *     Subtle enough not to feel "draggy" — just polished.
 *   • Click feedback (`.is-down`) — `mousedown` adds the class, `mouseup` clears it; CSS
 *     contracts the ring + expands the inner dot for tactile pressure.
 *   • Reduced-motion + coarse-pointer + no-hover → opt out entirely (no body class, no DOM).
 *
 *  CSS hides the native cursor only when `has-custom-cursor` is set, and only inside the
 *  `(pointer: fine) and (hover: hover)` media query, so touch users keep their OS cursor.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useSiteCursor
 */

import { useEffect } from "react";

const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, summary, [role="button"], [role="link"]';

// Magnetic snap pulls the cursor 15% toward the element centre — strong enough to read
// as "settled on" the link, gentle enough that fast cross-screen sweeps don't feel sticky.
const MAGNETIC_WEIGHT = 0.15;

export function useSiteCursor(cursorRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine) and (hover: hover)").matches) return;
    // Honour the platform-level reduced-motion preference — a lerp-following cursor is
    // motion, even subtle. Users who opted out should see the native pointer untouched.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.body.classList.add("has-custom-cursor");

    // SiteCursor is persisted across ClientRouter swaps (transition:persist) so its useEffect
    // runs only once — BUT Astro replaces body.className entirely with the new page's
    // bodyClass on swap, wiping our `has-custom-cursor` class. Without this listener the
    // native pointer flashes back on the very first navigation. Re-apply on every swap.
    const onAfterSwap = () => document.body.classList.add("has-custom-cursor");
    document.addEventListener("astro:after-swap", onAfterSwap);

    let targetX = -120;
    let targetY = -120;
    let currentX = -120;
    let currentY = -120;
    let raf: number | null = null;

    const render = () => {
      currentX += (targetX - currentX) * 0.24;
      currentY += (targetY - currentY) * 0.24;
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      raf = window.requestAnimationFrame(render);
    };

    const move = (event: MouseEvent) => {
      const target = event.target;
      const interactiveEl =
        target instanceof Element ? target.closest<HTMLElement>(INTERACTIVE_SELECTOR) : null;
      const interactive = Boolean(interactiveEl);

      if (interactive && interactiveEl) {
        // Magnetic snap: bias the target toward the element centre. Cursor's actual position
        // still tracks the mouse — but it lands ON the link's heart, not next to it.
        const rect = interactiveEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        targetX = event.clientX + (cx - event.clientX) * MAGNETIC_WEIGHT;
        targetY = event.clientY + (cy - event.clientY) * MAGNETIC_WEIGHT;
      } else {
        targetX = event.clientX;
        targetY = event.clientY;
      }
      el.classList.toggle("is-pointer", interactive);
      if (raf === null) render();
    };

    const leave = () => {
      el.style.opacity = "0";
    };
    const enter = () => {
      el.style.opacity = "";
    };
    // Click feedback — adds `.is-down` for the duration of the press. CSS contracts the
    // ring and expands the inner dot, reading as a tactile press without firing animation.
    const down = () => el.classList.add("is-down");
    const up = () => el.classList.remove("is-down");

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseleave", leave);
    window.addEventListener("mouseenter", enter);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("blur", up); // dropped focus mid-press → clear state

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
      window.removeEventListener("mouseenter", enter);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("blur", up);
      document.removeEventListener("astro:after-swap", onAfterSwap);
      if (raf !== null) window.cancelAnimationFrame(raf);
      document.body.classList.remove("has-custom-cursor");
    };
  }, [cursorRef]);
}
