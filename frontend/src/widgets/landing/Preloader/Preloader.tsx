/**
 * @file Preloader.tsx
 * @description Opening dark-rite preloader. Self-removes after window `load` (with a
 * 3.4s minimum so the rite has time to bloom) or after a 4.2s safety ceiling. The
 * candle mark animates in last so the choreography feels intentional.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/Preloader
 */

import { useEffect, useState } from "react";

import { useBodyClass } from "@/features/landing/hooks/useBodyClass";

const MIN_DURATION = 3400;
const SAFETY_CEILING = 4200;
const EXIT_DURATION = 1100;

export function Preloader(): React.JSX.Element | null {
  const [phase, setPhase] = useState<"shown" | "hiding" | "removed">("shown");
  useBodyClass(phase === "removed" ? null : "preload-open");

  useEffect(() => {
    if (phase !== "shown") return;
    const startedAt = performance.now();
    let timer: number | undefined;

    const beginHide = () => {
      const remaining = Math.max(0, MIN_DURATION - (performance.now() - startedAt));
      timer = window.setTimeout(() => setPhase("hiding"), remaining);
    };

    if (document.readyState === "complete") {
      beginHide();
    } else {
      window.addEventListener("load", beginHide, { once: true });
    }
    const safety = window.setTimeout(beginHide, SAFETY_CEILING);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(safety);
      window.removeEventListener("load", beginHide);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const timer = window.setTimeout(() => setPhase("removed"), EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "removed") return null;

  return (
    <div className={`preloader${phase === "hiding" ? " is-hidden" : ""}`} aria-hidden="true">
      <span className="preloader-spark" />
      <span className="preloader-ring r1" />
      <span className="preloader-ring r2" />
      <span className="preloader-ring r3" />
      <span className="preloader-word w1">cisza</span>
      <span className="preloader-word w2">głos</span>
      <svg className="preloader-mark" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="3" stroke="currentColor" strokeWidth="1" />
        <path
          d="M32 6V22M32 42V58M6 32H22M42 32H58M14 14L25 25M39 39L50 50M50 14L39 25M25 39L14 50"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
