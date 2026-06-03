/**
 * @file useUnsavedChangesWarning.ts
 * @description Guards against losing in-progress edits on a hard navigation
 * (tab close, reload, address-bar change) by arming the native `beforeunload`
 * prompt only while a surface reports unsaved changes. In-app route changes are
 * not covered here — the app uses a declarative `<BrowserRouter>` where
 * `useBlocker` is unavailable, so soft-navigation guarding is handled at the
 * route level (see the Project Hub dirty-state confirm flow).
 * @module shared/lib/dom/useUnsavedChangesWarning
 */

import { useEffect } from "react";

/**
 * Arms the browser's native "Leave site?" prompt while `enabled` is true.
 * The listener is attached lazily and torn down the moment the surface goes
 * clean, so a pristine editor never blocks a refresh.
 */
export const useUnsavedChangesWarning = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      // Legacy browsers require a truthy `returnValue` to show the prompt.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled]);
};
