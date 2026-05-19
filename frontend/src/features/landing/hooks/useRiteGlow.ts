/**
 * @file useRiteGlow.ts
 * @description Mouse-tracked spotlight on the image-rite section. Writes CSS custom
 * properties `--glow-x` and `--glow-y` (in % of the section's bounding rect) so the
 * radial gradient defined in CSS follows the cursor. Desktop-only, no-op under
 * coarse pointer / reduced motion.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useRiteGlow
 */

import { useEffect } from "react";

export function useRiteGlow(riteRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const rite = riteRef.current;
    if (!rite) return;
    if (!window.matchMedia("(pointer: fine) and (hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pending = false;
    let lastX = 50;
    let lastY = 50;

    const apply = () => {
      rite.style.setProperty("--glow-x", `${lastX}%`);
      rite.style.setProperty("--glow-y", `${lastY}%`);
      pending = false;
    };

    const onEnter = () => rite.classList.add("is-glowing");
    const onLeave = () => rite.classList.remove("is-glowing");
    const onMove = (event: PointerEvent) => {
      const rect = rite.getBoundingClientRect();
      lastX = ((event.clientX - rect.left) / rect.width) * 100;
      lastY = ((event.clientY - rect.top) / rect.height) * 100;
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(apply);
    };

    rite.addEventListener("pointerenter", onEnter);
    rite.addEventListener("pointerleave", onLeave);
    rite.addEventListener("pointermove", onMove);
    return () => {
      rite.removeEventListener("pointerenter", onEnter);
      rite.removeEventListener("pointerleave", onLeave);
      rite.removeEventListener("pointermove", onMove);
    };
  }, [riteRef]);
}
