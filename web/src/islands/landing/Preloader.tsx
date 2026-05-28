/**
 * @file Preloader.tsx
 * @description Opening dark-rite preloader. Self-removes after window `load` (with a
 * 3.4s minimum so the rite has time to bloom) or after a 4.2s safety ceiling. The
 * candle mark animates in last so the choreography feels intentional.
 *
 * Once-per-session contract: the rite is a threshold, not a navigation animation —
 * showing it on every ClientRouter return to "/" would devalue it. A sessionStorage
 * flag (`voct.preloader.seen`) is written when the first reveal completes, and
 * subsequent mounts skip straight to "removed". The companion inline head script in
 * index.astro adds `html.preloader-skip` before paint so returning visitors never
 * even see the SSR'd preloader markup flash before React decides to skip it.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/Preloader
 */

import { useEffect, useState } from "react";

import { useBodyClass } from "./hooks/useBodyClass";

// 2026: 3.4s rite was too long on returning paint-cached visits. 2.2s keeps the candle
// bloom + ring expansion intact (animations were always front-loaded under 2s) while
// shortening the time-to-content. SAFETY_CEILING stays a beat above MIN so a slow
// `load` event still resolves through it. EXIT shortened in tandem so the total
// "splash budget" is ~2.9s (vs the old 4.5s) without recutting any choreography.
const MIN_DURATION = 2200;
const SAFETY_CEILING = 3000;
const EXIT_DURATION = 700;
const SEEN_KEY = "voct.preloader.seen";

function preloaderAlreadySeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markPreloaderSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode / disabled storage — non-fatal */
  }
}

export function Preloader(): React.JSX.Element | null {
  // Initial state is deterministic ("shown") so SSR and the first client render agree —
  // hydration mismatches would strand a dead SSR overlay. The session-storage decision
  // happens in a layout-effect-ish useEffect below; the CSS in landing.css gated on
  // `html.preloader-skip` (set by the inline head script) prevents any visible flash.
  const [phase, setPhase] = useState<"shown" | "hiding" | "removed">("shown");
  useBodyClass(phase === "removed" ? null : "preload-open");

  useEffect(() => {
    if (phase !== "shown") return;

    // Returning visitor within the same session: jump straight to "removed".
    if (preloaderAlreadySeen()) {
      setPhase("removed");
      return;
    }

    const startedAt = performance.now();
    let timer: number | undefined;

    const beginHide = () => {
      const remaining = Math.max(0, MIN_DURATION - (performance.now() - startedAt));
      timer = window.setTimeout(() => {
        markPreloaderSeen();
        setPhase("hiding");
      }, remaining);
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
