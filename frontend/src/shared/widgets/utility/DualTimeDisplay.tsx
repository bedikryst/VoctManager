/**
 * @file DualTimeDisplay.tsx
 * @description Enterprise UI Component for dual-timezone time presentation.
 * Automatically handles the display of event timezone vs local user timezone.
 * Refined for Ethereal UI: Strict baseline alignments and sub-pixel typography.
 * @architecture Enterprise SaaS 2026
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
    variant: {
      default: "",
      dark: "",
    },
  },
  defaultVariants: {
    spacing: "default",
    variant: "default",
  },
});

const primaryTimeVariants = cva("flex items-baseline gap-2 tracking-wide", {
  variants: {
    typography: {
      serif: "font-serif",
      sans: "font-sans",
    },
    color: {
      default: "text-ethereal-ink",
      muted: "text-ethereal-graphite/60",
      gold: "text-ethereal-gold",
      incense: "text-ethereal-incense/60",
      dark: "text-ethereal-parchment",
      "dark-muted": "text-ethereal-parchment/70",
    },
    size: {
      xs: "text-[10px]",
      sm: "text-xs",
      base: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-[22px]",
      "3xl": "text-3xl",
      "4xl": "text-3xl lg:text-4xl",
      huge: "text-3xl lg:text-5xl xl:text-6xl",
    },
    weight: {
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    typography: "sans",
    color: "default",
    size: "base",
    weight: "normal",
  },
});

const localTimeVariants = cva(
  "text-[9px] font-bold uppercase tracking-[0.25em] flex items-center gap-1.5",
  {
    variants: {
      variant: {
        default: "text-ethereal-incense/80",
        dark: "text-ethereal-parchment/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface DualTimeDisplayProps extends VariantProps<
  typeof containerVariants
> {
  value: Date | string | number | null | undefined;
  timeZone?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  typography?: VariantProps<typeof primaryTimeVariants>["typography"];
  color?: VariantProps<typeof primaryTimeVariants>["color"];
  size?: VariantProps<typeof primaryTimeVariants>["size"];
  weight?: VariantProps<typeof primaryTimeVariants>["weight"];
  variant?: "default" | "dark";
  className?: string;
  containerClassName?: string;
  timeClassName?: string;
  primaryTimeClassName?: string;
  localTimeClassName?: string;
}

export const DualTimeDisplay = ({
  value,
  timeZone,
  label,
  icon,
  spacing,
  typography,
  color,
  size,
  weight,
  variant = "default",
  className,
  containerClassName,
  timeClassName,
  primaryTimeClassName,
  localTimeClassName,
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

  // Resolve defaults based on variant if not explicitly provided
  const resolvedColor = color || (variant === "dark" ? "dark" : "default");

  return (
    <div
      className={cn(
        containerVariants({ spacing, variant }),
        className,
        containerClassName,
      )}
    >
      <div
        className={cn(
          primaryTimeVariants({
            typography,
            color: resolvedColor,
            size,
            weight,
          }),
          timeClassName,
          primaryTimeClassName,
        )}
      >
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 self-center translate-y-[1px]",
              variant === "dark"
                ? "text-ethereal-gold/90"
                : "text-ethereal-gold/80",
            )}
          >
            {icon}
          </span>
        )}

        {label && (
          <span
            className={cn(
              "font-sans text-[10px] font-bold uppercase tracking-widest mr-1 self-center",
              variant === "dark"
                ? "text-ethereal-parchment/60"
                : "text-ethereal-graphite/70",
            )}
          >
            {label}
          </span>
        )}

        <time
          dateTime={isoDateString}
          className="whitespace-nowrap tabular-nums"
        >
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

          <time
            dateTime={isoDateString}
            className={cn(localTimeVariants({ variant }), localTimeClassName)}
          >
            <span className="sr-only">
              {t("common.time.localAria", "Twój czas lokalny to:")}
            </span>
            <span className="tabular-nums">
              {formatLocalizedTime(
                value,
                localTimeOptions,
                undefined,
                userTimezone,
              )}
            </span>
            <span
              className={cn(
                "font-sans text-[12px] font-bold lowercase tracking-normal",
                variant === "dark"
                  ? "text-ethereal-parchment/40"
                  : "text-ethereal-incense/50",
              )}
            >
              {t("common.time.localSuffix", "(twój czas)")}
            </span>
          </time>
        </div>
      )}
    </div>
  );
};
