/**
 * @file useNow.ts
 * @description A ticking clock hook. Returns a Date that refreshes on an
 * interval so countdowns and time-window states (e.g. "rehearsal mode")
 * stay live without a manual refresh. Default cadence is 30s — fine-grained
 * enough for minute countdowns, cheap enough to ignore.
 */

import { useEffect, useState } from "react";

export const useNow = (intervalMs = 30_000): Date => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
};
