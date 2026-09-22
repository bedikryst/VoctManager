/**
 * @file useNotesPin.ts
 * @description Persisted "lock the notes rail open" state — mirrors
 * `../hooks/useSidebarPin.ts` exactly. Unlike the sidebar, the rail is an
 * overlay by default (zero footprint, `COLLAPSED_PAD`), so it only reflows
 * `<main>` once pinned. Drives the `--rail-pad` CSS var `DashboardLayout`
 * reads for its `wide-shell:pr-*` slot.
 * @module widgets/panel-shell/notes
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "voct.notes.pinned";

/** Overlay footprint: unpinned, the rail reflows nothing. */
const COLLAPSED_PAD = "0px";
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
    "--rail-pad",
    pinned ? PINNED_PAD : COLLAPSED_PAD,
  );
};

export const useNotesPin = () => {
  const [isPinned, setIsPinned] = useState<boolean>(readInitialPin);

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
