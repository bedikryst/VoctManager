/**
 * @file UserLocalClock.tsx
 * @description Astral Chronometer for Ethereal UI 2026.
 * Zero-box paradigm. Pure typography with an expanding kinetic dimension for seconds.
 * Resolves V8 event-loop drift via recursive delta timeouts.
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/utility/UserLocalClock
 */

import React, { useState, useEffect, useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";

export const UserLocalClock = (): React.JSX.Element | null => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [time, setTime] = useState<Date>(new Date());

  const fallbackTimezone = t("common.timezones.defaultFallback", "UTC");
  const userTimezone = user?.profile?.timezone || fallbackTimezone;

  // 1. PRECISION TICK ENGINE (Zero Drift)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const syncClock = () => {
      const now = new Date();
      setTime(now);
      const msToNextSecond = 1000 - now.getMilliseconds();
      timeoutId = setTimeout(syncClock, msToNextSecond);
    };

    syncClock();
    return () => clearTimeout(timeoutId);
  }, []);

  // 2. ASTRAL FORMATTERS
  const { hours, minutes, seconds, date, displayZone } = useMemo(() => {
    return {
      hours: formatInTimeZone(time, userTimezone, "HH"),
      minutes: formatInTimeZone(time, userTimezone, "mm"),
      seconds: formatInTimeZone(time, userTimezone, "ss"),
      date: formatInTimeZone(time, userTimezone, "dd.MM.yyyy"),
      displayZone:
        userTimezone.split("/").pop()?.replace(/_/g, " ") || fallbackTimezone,
    };
  }, [time, userTimezone, fallbackTimezone]);

  if (!user) return null;

  return (
    <article
      className="group relative flex cursor-default flex-col items-end outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 focus-visible:ring-offset-8 focus-visible:ring-offset-transparent"
      role="timer"
      aria-label={t("common.time.clock_aria", "Zegar lokalny użytkownika")}
      tabIndex={0}
    >
      {/* UPPER STRATUM: The Marginalia (Tempo & Location) */}
      <div className="mb-1.5 flex items-center gap-3 pr-1 opacity-50 transition-all duration-700 ease-[0.16,1,0.3,1] group-hover:opacity-100 group-hover:-translate-y-0.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-ethereal-graphite">
          {displayZone}
        </span>
        {/* Sacral Golden Thread */}
        <span
          className="h-[1px] w-6 bg-gradient-to-r from-transparent via-ethereal-gold/50 to-transparent"
          aria-hidden="true"
        />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/80">
          {date}
        </span>
      </div>

      {/* CORE STRATUM: Deconstructed Chronometry */}
      <time
        dateTime={time.toISOString()}
        className="flex items-center text-ethereal-ink transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:-translate-y-0.5"
      >
        {/* Hours: Massive, Editorial Serif */}
        <span className="font-serif text-[2.25rem] font-thin leading-none tracking-tighter sm:text-[3rem]">
          {hours}
        </span>

        {/* Separator: The Celestial Orb */}
        <span className="relative mx-3 flex h-full items-center justify-center">
          <span
            className="absolute h-1.5 w-1.5 rounded-full bg-ethereal-gold/80 shadow-[0_0_12px_rgba(194,168,120,0.6)] transition-all duration-1000 animate-pulse group-hover:bg-ethereal-gold group-hover:shadow-[0_0_16px_rgba(194,168,120,0.9)] group-hover:scale-110"
            aria-hidden="true"
          />
        </span>

        {/* Minutes: Tabular, Sharp, Slightly Transparent */}
        <span className="font-sans text-[1.75rem] font-light leading-none tracking-normal tabular-nums text-ethereal-graphite/70 sm:text-[2rem]">
          {minutes}
        </span>

        {/* KINEMATIC DIMENSION: Seconds Reveal */}
        {/* Hides completely by default. Expands flawlessly via Framer-like bezier transitions on CSS */}
        <span
          className="flex items-end overflow-hidden opacity-0 transition-all duration-[800ms] ease-[0.16,1,0.3,1] max-w-0 group-hover:max-w-[4rem] group-hover:opacity-100 group-hover:ml-2"
          aria-hidden="true"
        >
          <span className="font-serif text-[1.2rem] font-light leading-none tabular-nums text-ethereal-gold/70 pb-[3px]">
            {seconds}
          </span>
        </span>
      </time>
    </article>
  );
};

UserLocalClock.displayName = "UserLocalClock";
