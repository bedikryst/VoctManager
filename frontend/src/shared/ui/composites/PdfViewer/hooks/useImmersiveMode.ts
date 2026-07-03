/**
 * @file useImmersiveMode.ts
 * @description Performance mode for a score on a music stand: hides all viewer
 * chrome and best-effort promotes the viewer element to browser fullscreen.
 * Stays a single source of truth with the Fullscreen API — when the UA exits
 * fullscreen on its own (Esc, system gesture), immersive state follows. Where
 * element fullscreen is unavailable (iPhone Safari) the mode degrades to
 * chrome-hiding only, which is still the useful half.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useEffect, useState, type RefObject } from "react";

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const currentFullscreenElement = (): Element | null => {
  const doc = document as FullscreenCapableDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

const swallowRejection = (result: Promise<void> | void): void => {
  if (result instanceof Promise) result.catch(() => undefined);
};

export interface ImmersiveMode {
  isImmersive: boolean;
  enter: () => void;
  exit: () => void;
}

export const useImmersiveMode = (
  rootRef: RefObject<HTMLElement | null>,
  onChange?: (active: boolean) => void,
): ImmersiveMode => {
  const [isImmersive, setIsImmersive] = useState(false);

  const enter = useCallback(() => {
    setIsImmersive(true);
    onChange?.(true);
    const root = rootRef.current as FullscreenCapableElement | null;
    if (!root) return;
    try {
      const request =
        root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
      if (request) swallowRejection(request());
    } catch {
      // Unsupported — immersive still hides chrome.
    }
  }, [onChange, rootRef]);

  const exit = useCallback(() => {
    setIsImmersive(false);
    onChange?.(false);
    if (!currentFullscreenElement()) return;
    const doc = document as FullscreenCapableDocument;
    try {
      const exitFullscreen =
        doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
      if (exitFullscreen) swallowRejection(exitFullscreen());
    } catch {
      // Already exited by the UA.
    }
  }, [onChange]);

  // The UA can leave fullscreen without asking us (Esc, system gesture,
  // element removal) — follow it so chrome comes back.
  useEffect(() => {
    if (!isImmersive) return;
    const handleFullscreenChange = (): void => {
      if (!currentFullscreenElement()) {
        setIsImmersive(false);
        onChange?.(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [isImmersive, onChange]);

  return { isImmersive, enter, exit };
};
