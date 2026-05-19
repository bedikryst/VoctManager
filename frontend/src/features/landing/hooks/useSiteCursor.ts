/**
 * @file useSiteCursor.ts
 * @description Custom site cursor with lerp easing. Adds `has-custom-cursor` to body
 * (CSS hides the native cursor for fine pointers only). Cursor adopts `is-pointer`
 * state over interactive elements.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useSiteCursor
 */

import { useEffect } from "react";

export function useSiteCursor(cursorRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine) and (hover: hover)").matches) return;

    document.body.classList.add("has-custom-cursor");

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
      targetX = event.clientX;
      targetY = event.clientY;
      const target = event.target;
      const interactive =
        target instanceof Element &&
        Boolean(
          target.closest(
            'a, button, input, textarea, select, summary, [role="button"], [role="link"]',
          ),
        );
      el.classList.toggle("is-pointer", interactive);
      if (raf === null) render();
    };

    const leave = () => {
      el.style.opacity = "0";
    };
    const enter = () => {
      el.style.opacity = "";
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseleave", leave);
    window.addEventListener("mouseenter", enter);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
      window.removeEventListener("mouseenter", enter);
      if (raf !== null) window.cancelAnimationFrame(raf);
      document.body.classList.remove("has-custom-cursor");
    };
  }, [cursorRef]);
}
