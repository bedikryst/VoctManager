/**
 * @file useCopyToClipboard.ts
 * @description Clipboard copy with a transient "copied" state for visual feedback.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useCopyToClipboard
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useCopyToClipboard(resetMs = 1800): {
  readonly copied: boolean;
  readonly copy: (value: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(
    async (value: string) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), resetMs);
      } catch {
        /* silently ignore — clipboard API can be unavailable in iframes */
      }
    },
    [resetMs],
  );

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { copied, copy };
}
