/**
 * @file useCloseWatcher.ts
 * @description Enterprise-grade hook for managing the UI close stack.
 * Seamlessly integrates the modern CloseWatcher API (for Android Back Button & ESC)
 * with a graceful fallback for legacy browsers.
 *  * * @param isOpen - A flag indicating whether a given component (modal/menu/form) is open
 * @param onClose - A function that closes this particular component
 * * @module shared/lib/dom/useCloseWatcher
 */

import { useEffect } from "react";

export const useCloseWatcher = (isOpen: boolean, onClose: () => void): void => {
  useEffect(() => {
    if (!isOpen) return;

    if ("CloseWatcher" in window) {
      const watcher = new (window as any).CloseWatcher();

      watcher.onclose = () => {
        onClose();
      };

      return () => {
        try {
          watcher.destroy();
        } catch (e) {}
      };
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose]);
};
