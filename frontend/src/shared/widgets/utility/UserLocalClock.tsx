/**
 * @file UserLocalClock.tsx
 * @description Minimalist chronometer displaying the user's local time.
 * Conforms to Ethereal UI standards: strict hardware isolation, 'Lead Came' borders,
 * semantic <time> markup, and mono-spaced typographic rhythm.
 * @module shared/widgets/utility/UserLocalClock
 */

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";

export const UserLocalClock = (): React.JSX.Element | null => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [time, setTime] = useState<Date>(new Date());

  const fallbackTimezone = t("common.timezones.defaultFallback", "UTC");
  const userTimezone = user?.profile?.timezone || fallbackTimezone;

  // Precision chronometer tick
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  const formattedTime = formatInTimeZone(time, userTimezone, "HH:mm");
  const formattedDate = formatInTimeZone(time, userTimezone, "dd.MM.yyyy");

  const displayZone =
    userTimezone.split("/").pop()?.replace(/_/g, " ") || fallbackTimezone;

  return (
    <div
      className="group isolate flex items-center gap-4 rounded-2xl border border-ethereal-ink/10 bg-white/[0.03] px-5 py-2.5 shadow-[0_8px_20px_-6px_rgba(22,20,18,0.1),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-[16px] transition-all duration-700 will-change-transform hover:-translate-y-0.5 hover:border-ethereal-ink/15 hover:bg-white/[0.06] hover:shadow-[0_12px_24px_-8px_rgba(22,20,18,0.15),inset_0_1px_0_rgba(255,255,255,0.5)]"
      role="timer"
      aria-live="polite"
    >
      {/* Iconography: The Silent Escapement */}
      <div className="flex shrink-0 items-center justify-center">
        <Clock
          size={16}
          strokeWidth={1.5}
          className="text-ethereal-gold/70 transition-colors duration-500 group-hover:text-ethereal-gold"
          aria-hidden="true"
        />
      </div>

      {/* Typography: Editorial Chronometrics */}
      <div className="flex min-w-[75px] flex-col">
        {/* Semantic <time> with tabular-nums for rigid vertical alignment during ticks */}
        <time
          dateTime={time.toISOString()}
          className="mb-1 tabular-nums font-serif text-[1.35rem] font-medium leading-none tracking-wide text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold"
        >
          {formattedTime}
        </time>
        <span className="max-w-[140px] truncate text-[8.5px] font-bold uppercase leading-none tracking-[0.2em] text-ethereal-graphite/70 transition-colors duration-500 group-hover:text-ethereal-graphite">
          {displayZone}{" "}
          <span className="mx-0.5 text-ethereal-gold/40" aria-hidden="true">
            •
          </span>{" "}
          {formattedDate}
        </span>
      </div>
    </div>
  );
};
