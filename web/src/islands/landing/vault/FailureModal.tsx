/**
 * @file FailureModal.tsx
 * @description Full-screen apology after a rejected payment. Listens for `?donated=failure` on
 *  mount, clears the `donated` + `donation` query params, and offers a retry that reopens the
 *  donation vault (via VaultContext). Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/FailureModal
 */

import { useCallback, useEffect, useState } from "react";

import { BrandGlyph } from "../BrandGlyph";
import { useLenisLock } from "../hooks/useLenisLock";
import { useVault } from "../providers/VaultContext";

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

export function FailureModal(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const { open: openVault } = useVault();

  useLenisLock(visible);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("donated") !== "failure") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("donated");
    url.searchParams.delete("donation");
    try {
      history.replaceState({}, "", url.toString());
    } catch {
      /* private-mode browsers may refuse; silent ignore is fine */
    }

    return waitForUI(() => setVisible(true));
  }, []);

  const close = useCallback(() => setVisible(false), []);
  const retry = useCallback(() => {
    close();
    openVault(100);
  }, [close, openVault]);

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
      className={`failure${visible ? " is-visible" : ""}`}
      id="failure"
      role="dialog"
      aria-modal="true"
      aria-hidden={!visible}
      aria-labelledby="failure-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="failure-inner">
        <div className="failure-mark" aria-hidden="true">
          <span className="failure-mark-halo" />
          <BrandGlyph />
        </div>
        <div className="failure-kicker micro">VoctEnsemble · cykl MMXXVI</div>
        <h1 className="failure-title" id="failure-title">
          Płatność nie<br />doszła do skutku.
        </h1>
        <p className="failure-strap">
          Przepraszamy, płatność nie mogła zostać przetworzona. Twoje środki nie zostały
          pobrane. Prosimy spróbować ponownie lub wybrać inną metodę.
        </p>
        <button
          type="button"
          className="failure-retry plausible-event-name=sprobuj+ponownie"
          onClick={retry}
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}
