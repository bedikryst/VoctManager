/**
 * @file useSidebarPin.ts
 * @description Persisted "lock the rail open" state for the desktop sidebar.
 * When pinned, the rail stops being a hover-peek overlay and becomes a fixed
 * column the page content reflows around — for conductors who keep the console
 * open across a long working session. Drives the shared `--sidebar-pad` CSS var
 * the shell reads, so the layout reflows with zero prop drilling.
 * @module widgets/panel-shell/hooks
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "voct.sidebar.pinned";

/** Collapsed rail footprint (16px inset + 88px rail) — matches `--spacing-sidebar`. */
const COLLAPSED_PAD = "104px";
/** Pinned rail footprint (16px inset + 280px expanded panel). */
const PINNED_PAD = "296px";

const readInitialPin = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const syncPadVariable = (pinned: boolean): void => {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--sidebar-pad",
    pinned ? PINNED_PAD : COLLAPSED_PAD,
  );
};

export const useSidebarPin = () => {
  const [isPinned, setIsPinned] = useState<boolean>(readInitialPin);

  // Keep the shell's reflow variable in lockstep with the pin state.
  useEffect(() => {
    syncPadVariable(isPinned);
    return () => syncPadVariable(false);
  }, [isPinned]);

  const togglePin = useCallback(() => {
    setIsPinned((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Private-mode / storage-disabled: pin still works for the session.
      }
      return next;
    });
  }, []);

  return { isPinned, togglePin };
};
