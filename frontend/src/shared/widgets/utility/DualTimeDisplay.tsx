/**
 * @file DualTimeDisplay.tsx
 * @description Enterprise UI Component for dual-timezone time presentation.
 * Automatically handles the display of event timezone vs local user timezone.
 * Refactored to Strict TS 7.0 and cva-driven Ethereal UI architecture.
 * @module shared/widgets/utility/DualTimeDisplay
 */

import React from "react";
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
  "flex items-center gap-2 font-semibold text-stone-800 tracking-tight",
);
const localTimeVariants = cva(
  "text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] pl-6 opacity-80",
);

export interface DualTimeDisplayProps extends VariantProps<
  typeof containerVariants
> {
  value: Date | string | number | null | undefined;
  timeZone?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
}

export const DualTimeDisplay = ({
  value,
  timeZone,
  label,
  icon,
  spacing,
}: DualTimeDisplayProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();

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
    <div className={cn(containerVariants({ spacing }))}>
      <span className={primaryTimeVariants()}>
        {icon && <span aria-hidden="true">{icon}</span>}
        {label && <span>{label}</span>}
        {formatLocalizedTime(
          value,
          primaryTimeOptions,
          undefined,
          eventTimezone,
        )}
      </span>

      {hasDiffTz && (
        <span className={localTimeVariants()}>
          {formatLocalizedTime(
            value,
            localTimeOptions,
            undefined,
            userTimezone,
          )}{" "}
          {t("common.time.localSuffix", "(Twój czas)")}
        </span>
      )}
    </div>
  );
};
