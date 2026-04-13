/**
 * @file UserLocalClock.tsx
 * @description Minimalist widget displaying the user's local time based on their profile timezone.
 * Refactored to eliminate hardcoded CSS values and align with Ethereal UI standards.
 * @module shared/widgets/UserLocalClock
 */

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/app/providers/AuthProvider";

export const UserLocalClock = (): React.JSX.Element | null => {
  const { user } = useAuth();
  const [time, setTime] = useState<Date>(new Date());

  const userTimezone = user?.profile?.timezone || "UTC";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  const formattedTime = formatInTimeZone(time, userTimezone, "HH:mm");
  const formattedDate = formatInTimeZone(time, userTimezone, "dd.MM.yyyy");

  const displayZone =
    userTimezone.split("/").pop()?.replace(/_/g, " ") || "UTC";

  return (
    // Replaced arbitrary inline shadow with standard Tailwind v4 token 'shadow-sm'
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/60 backdrop-blur-xl border border-stone-200/60 rounded-2xl shadow-sm transition-all hover:bg-white/80">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand shrink-0">
        <Clock size={16} strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div className="flex flex-col min-w-[70px]">
        <span className="text-sm font-black text-stone-800 tracking-tight leading-none mb-0.5 antialiased">
          {formattedTime}
        </span>
        <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.15em] leading-none truncate max-w-[120px]">
          {displayZone} • {formattedDate}
        </span>
      </div>
    </div>
  );
};
