/**
 * @file GratitudeModal.tsx
 * @description Full-screen "thank you" reveal after a successful donation. Listens for
 * `?donated=success` on mount, waits until preloader + threshold are dismissed, then
 * fades in. Clears the query param via `history.replaceState` so reloads don't re-trigger.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/ResultModals/GratitudeModal
 */

import { useCallback, useEffect, useState } from "react";
import { useLenis } from "lenis/react";

import { BrandGlyph } from "@/widgets/landing/BrandGlyph/BrandGlyph";

function waitForUI(showNow: () => void): () => void {
  let cancelled = false;
  const check = () => {
    if (cancelled) return;
    if (
      document.body.classList.contains("preload-open") ||
      document.body.classList.contains("threshold-open")
    ) {
      window.setTimeout(check, 300);
    } else {
      window.setTimeout(() => {
        if (!cancelled) showNow();
      }, 400);
    }
  };
  check();
  return () => {
    cancelled = true;
  };
}

export function GratitudeModal(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("donated") !== "success") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("donated");
    try {
      history.replaceState({}, "", url.toString());
    } catch {
      /* private-mode browsers may refuse; silent ignore is fine */
    }

    return waitForUI(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (!lenis) return;
    if (visible) lenis.stop();
    else lenis.start();
  }, [visible, lenis]);

  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, close]);

  return (
    <div
      className={`gratitude${visible ? " is-visible" : ""}`}
      id="gratitude"
      role="dialog"
      aria-modal="true"
      aria-hidden={!visible}
      aria-labelledby="gratitude-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="gratitude-inner">
        <div className="gratitude-mark" aria-hidden="true">
          <span className="gratitude-mark-halo" />
          <BrandGlyph />
        </div>
        <div className="gratitude-kicker micro">VoctEnsemble · cykl MMXXVI</div>
        <h1 className="gratitude-title" id="gratitude-title">
          Twój głos<br />dołączył do chóru.
        </h1>
        <p className="gratitude-strap">
          Dziękujemy. Niech ta muzyka wybrzmiewa dalej — także dzięki Tobie.
        </p>
        <button type="button" className="gratitude-close" onClick={close}>
          Wróć do strony
        </button>
      </div>
    </div>
  );
}
