/**
 * @file useWakeLock.ts
 * @description Screen Wake Lock for performance surfaces — a score open on a
 * music stand must never sleep mid-rehearsal. Best-effort by design: acquires
 * while `active`, re-acquires when the tab returns to the foreground (the UA
 * releases the sentinel on visibility loss) and stays silent where the API is
 * unsupported or denied (battery saver) — a sleeping screen is an acceptable
 * fallback, a broken viewer is not.
 * @module shared/lib/hardware
 * @architecture Enterprise SaaS 2026
 */

import { useEffect } from "react";

export const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    // Runtime guard — lib.dom types the API unconditionally, older UAs lack it.
    if (!("wakeLock" in navigator)) return;
    const wakeLock = navigator.wakeLock;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async (): Promise<void> => {
      try {
        const next = await wakeLock.request("screen");
        if (disposed) {
          await next.release();
          return;
        }
        sentinel = next;
      } catch {
        // Denied (battery saver, permissions policy) — non-fatal by design.
      }
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
};
