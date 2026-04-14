/**
 * @file DualTimeDisplay.tsx
 * @description Enterprise UI Component for dual-timezone time presentation.
 * Automatically handles the display of event timezone vs local user timezone.
 * Refactored to Strict TS 7.0 and cva-driven Ethereal UI architecture.
 * @module shared/widgets/utility/DualTimeDisplay
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cva, type VariantProps } from "class-variance-authority";
import { formatLocalizedTime } from "@/shared/lib/time/intl";
import { useAuth } from "@/app/providers/AuthProvider";
import { cn } from "@/shared/lib/utils";

const containerVariants = cva("flex flex-col transition-all duration-300", {
  variants: {
    spacing: {
      default: "gap-1",
      compact: "gap-0.5",
    },
  },
  defaultVariants: {
    spacing: "default",
  },
});

const primaryTimeVariants = cva(
  "flex items-center gap-2 font-medium text-ethereal-ink tracking-wide",
  {
    variants: {
      typography: {
        serif: "font-serif text-[1.1em]",
        sans: "font-sans text-base tabular-nums",
      },
    },
    defaultVariants: {
      typography: "serif",
    },
  },
);

const localTimeVariants = cva(
  "text-[10px] font-bold text-ethereal-incense uppercase tracking-[0.2em] opacity-80",
);

export interface DualTimeDisplayProps extends VariantProps<
  typeof containerVariants
> {
  value: Date | string | number | null | undefined;
  timeZone?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  typography?: VariantProps<typeof primaryTimeVariants>["typography"];
  className?: string;
  timeClassName?: string;
}

export const DualTimeDisplay = ({
  value,
  timeZone,
  label,
  icon,
  spacing,
  typography,
  className,
  timeClassName,
}: DualTimeDisplayProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const isoDateString = useMemo(() => {
    if (!value) return undefined;
    try {
      return new Date(value).toISOString();
    } catch {
      return undefined;
    }
  }, [value]);

  if (!value) return null;

  const fallbackTz = t("common.timezones.defaultFallback", "UTC");
  const userTimezone = user?.profile?.timezone || fallbackTz;
  const eventTimezone = timeZone || "Europe/Warsaw";

  const hasDiffTz = eventTimezone !== userTimezone;

  const primaryTimeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(hasDiffTz && { timeZoneName: "short" }),
  };

  const localTimeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };

  return (
    <div className={cn(containerVariants({ spacing }), className)}>
      <div className={cn(primaryTimeVariants({ typography }), timeClassName)}>
        {icon && (
          <span
            aria-hidden="true"
            className="text-ethereal-gold/70 shrink-0 flex items-center"
          >
            {icon}
          </span>
        )}

        {label && (
          <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite/80 mr-1">
            {label}
          </span>
        )}

        <time dateTime={isoDateString} className="whitespace-nowrap">
          {formatLocalizedTime(
            value,
            primaryTimeOptions,
            undefined,
            eventTimezone,
          )}
        </time>
      </div>

      {hasDiffTz && (
        <div className="flex items-center">
          {icon && (
            <span className="w-5 shrink-0 invisible" aria-hidden="true" />
          )}

          <time dateTime={isoDateString} className={localTimeVariants()}>
            <span className="sr-only">
              {t("common.time.localAria", "Twój czas lokalny to:")}
            </span>
            {formatLocalizedTime(
              value,
              localTimeOptions,
              undefined,
              userTimezone,
            )}{" "}
            <span className="font-normal text-ethereal-incense/60">
              {t("common.time.localSuffix", "(Twój czas)")}
            </span>
          </time>
        </div>
      )}
    </div>
  );
};
