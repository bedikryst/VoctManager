/**
 * @file UserLocalClock.tsx
 * @description Enterprise Precision Chronometer.
 * Resolves V8 event-loop drift via recursive delta timeouts.
 * Fixes critical A11y aria-live spam. Hardware-accelerated colon escapement.
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/utility/UserLocalClock
 */

import React, { useState, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";

export const UserLocalClock = (): React.JSX.Element | null => {
  const { user } = useAuth();
  const { t } = useTranslation();

  // State holds precise Date object
  const [time, setTime] = useState<Date>(new Date());

  const fallbackTimezone = t("common.timezones.defaultFallback", "UTC");
  const userTimezone = user?.profile?.timezone || fallbackTimezone;

  // 1. PRECISION TICK ENGINE (Zero Drift)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const syncClock = () => {
      const now = new Date();
      setTime(now);
      // Calculate exact milliseconds until the next full second to prevent JS event-loop drift
      const msToNextSecond = 1000 - now.getMilliseconds();
      timeoutId = setTimeout(syncClock, msToNextSecond);
    };

    syncClock();
    return () => clearTimeout(timeoutId);
  }, []);

  // 2. MEMOIZED FORMATTERS
  const { hours, minutes, date, displayZone } = useMemo(() => {
    return {
      hours: formatInTimeZone(time, userTimezone, "HH"),
      minutes: formatInTimeZone(time, userTimezone, "mm"),
      date: formatInTimeZone(time, userTimezone, "dd.MM.yyyy"),
      displayZone:
        userTimezone.split("/").pop()?.replace(/_/g, " ") || fallbackTimezone,
    };
  }, [time, userTimezone, fallbackTimezone]);

  if (!user) return null;

  return (
    <div
      className="group isolate flex cursor-default items-center gap-4 rounded-2xl border border-ethereal-ink/5 bg-white/40 px-5 py-2.5 shadow-[0_8px_20px_-6px_rgba(22,20,18,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-[24px] transition-all duration-700 will-change-transform hover:-translate-y-0.5 hover:border-ethereal-gold/30 hover:bg-white/60 hover:shadow-[0_12px_24px_-8px_rgba(194,168,120,0.15),inset_0_1px_0_rgba(255,255,255,1)]"
      // Removed aria-live="polite". Real screen readers will read this correctly on focus.
      role="group"
      aria-label={t("common.time.clock_aria", "Zegar lokalny użytkownika")}
    >
      {/* Iconography */}
      <div className="flex shrink-0 items-center justify-center">
        <Clock
          size={16}
          strokeWidth={1.5}
          className="text-ethereal-incense transition-colors duration-500 group-hover:text-ethereal-gold"
          aria-hidden="true"
        />
      </div>

      {/* Typography: Editorial Chronometrics */}
      <div className="flex min-w-[75px] flex-col justify-center">
        <time
          dateTime={time.toISOString()}
          className="mb-0.5 flex tabular-nums font-serif text-[1.35rem] font-medium leading-none tracking-wide text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold"
        >
          <span>{hours}</span>
          <span
            className="opacity-100 transition-opacity duration-1000 animate-pulse text-ethereal-incense/50 group-hover:text-ethereal-gold/50"
            aria-hidden="true"
          >
            :
          </span>
          <span>{minutes}</span>
        </time>

        <span className="max-w-[140px] truncate text-[8.5px] font-bold uppercase leading-none tracking-[0.2em] text-ethereal-graphite/60 transition-colors duration-500 group-hover:text-ethereal-graphite/90">
          {displayZone}{" "}
          <span className="mx-0.5 text-ethereal-incense/40" aria-hidden="true">
            •
          </span>{" "}
          {date}
        </span>
      </div>
    </div>
  );
};
