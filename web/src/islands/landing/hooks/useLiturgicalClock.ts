/**
 * @file useLiturgicalClock.ts
 * @description Europe/Warsaw clock with synchronized hora canonica and tempus liturgicum.
 * Minute tick is synced to the minute boundary (then refreshed every 30s as safety);
 * seconds tick is synced to the second boundary (then 1s interval). Returns a stable
 * object the consumer can render directly.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useLiturgicalClock
 */

import { useEffect, useState } from "react";

import { horaForWarsaw, type CanonicalHour } from "../lib/horaeCanonicae";
import { tempusForDate, type Tempus } from "../../../lib/tempusLiturgicus";

const HM_FORMAT = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

export interface LiturgicalClock {
  readonly hm: string;
  readonly seconds: string;
  readonly hora: CanonicalHour;
  readonly tempus: Tempus;
}

function snapshot(): LiturgicalClock {
  const now = new Date();
  return {
    hm: HM_FORMAT.format(now),
    seconds: String(now.getSeconds()).padStart(2, "0"),
    hora: horaForWarsaw(now),
    tempus: tempusForDate(now),
  };
}

export function useLiturgicalClock(): LiturgicalClock {
  const [clock, setClock] = useState<LiturgicalClock>(() => snapshot());

  useEffect(() => {
    let secondInterval: number | undefined;
    let minuteInterval: number | undefined;

    const tickSeconds = () => setClock((prev) => {
      const next = String(new Date().getSeconds()).padStart(2, "0");
      return prev.seconds === next ? prev : { ...prev, seconds: next };
    });

    const tickMinute = () => setClock(snapshot);

    const now = new Date();
    const msToNextSecond = 1000 - now.getMilliseconds();
    const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());

    const secondTimeout = window.setTimeout(() => {
      tickSeconds();
      secondInterval = window.setInterval(tickSeconds, 1000);
    }, msToNextSecond + 10);

    const minuteTimeout = window.setTimeout(() => {
      tickMinute();
      minuteInterval = window.setInterval(tickMinute, 30_000);
    }, msToNextMinute + 50);

    return () => {
      window.clearTimeout(secondTimeout);
      window.clearTimeout(minuteTimeout);
      if (secondInterval) window.clearInterval(secondInterval);
      if (minuteInterval) window.clearInterval(minuteInterval);
    };
  }, []);

  return clock;
}
