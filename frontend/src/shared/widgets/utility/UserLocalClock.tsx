/**
 * @file UserLocalClock.tsx
 * @description Minimalist widget displaying the user's local time based on their profile timezone.
 * Conforms to Ethereal UI standards using cva for variant management and strict TypeScript.
 * @module shared/widgets/utility/UserLocalClock
 */

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { cva, type VariantProps } from "class-variance-authority";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";

const clockWidgetVariants = cva(
  "flex items-center gap-3 px-4 py-2.5 backdrop-blur-xl border rounded-2xl shadow-sm transition-all duration-300",
  {
    variants: {
      theme: {
        ethereal: "bg-white/60 border-stone-200/60 hover:bg-white/80",
        dark: "bg-stone-900/60 border-stone-800/60 hover:bg-stone-900/80",
      },
    },
    defaultVariants: {
      theme: "ethereal",
    },
  },
);

interface UserLocalClockProps extends VariantProps<
  typeof clockWidgetVariants
> {}

export const UserLocalClock = ({
  theme,
}: UserLocalClockProps): React.JSX.Element | null => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [time, setTime] = useState<Date>(new Date());

  const fallbackTimezone = t("common.timezones.defaultFallback", "UTC");
  const userTimezone = user?.profile?.timezone || fallbackTimezone;

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
    <div className={clockWidgetVariants({ theme })}>
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
