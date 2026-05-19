/**
 * @file useCountdown.ts
 * @description Polls the day-delta between now and the next concert at a 1h cadence.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useCountdown
 */

import { useEffect, useState } from "react";

import { daysUntil } from "../lib/countdown";

export function useCountdown(target: Date): number {
  const [days, setDays] = useState<number>(() => daysUntil(target));
  useEffect(() => {
    const tick = () => setDays(daysUntil(target));
    tick();
    const interval = window.setInterval(tick, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [target]);
  return days;
}
