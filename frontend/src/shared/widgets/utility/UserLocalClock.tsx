/**
 * @file UserLocalClock.tsx
 * @description Minimalist chronometer displaying the user's local time.
 * Conforms to Ethereal UI standards: pure glassmorphism, editorial micro-typography, and zero tech-debt.
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
    <div className="group flex items-center gap-4 rounded-2xl border border-ethereal-incense/15 bg-white/5 px-5 py-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_12px_rgba(166,146,121,0.05)] backdrop-blur-xl transition-colors duration-700 hover:border-ethereal-gold/30 hover:bg-white/10">
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
        <span className="mb-1 font-serif text-[1.35rem] font-medium leading-none tracking-wide text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold">
          {formattedTime}
        </span>
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
