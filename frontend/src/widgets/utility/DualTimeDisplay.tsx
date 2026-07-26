/**
 * @file DualTimeDisplay.tsx
 * @description Enterprise UI Component for dual-timezone time presentation.
 * Automatically handles the display of event timezone vs local user timezone.
 * Refined for Ethereal UI: Strict baseline alignments and sub-pixel typography.
 * @architecture Enterprise SaaS 2026
 * @module widgets/utility/DualTimeDisplay
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cva, type VariantProps } from "class-variance-authority";
import { formatLocalizedTime } from "@/shared/lib/time/intl";
import { useAuth } from "@/app/providers/AuthProvider";
import { cn } from "@/shared/lib/utils";

const containerVariants = cva("flex transition-colors duration-300", {
  variants: {
    /**
     * Which way the two times stack. This is an explicit axis because callers
     * used to fight the hard-coded column by passing `items-center` — which
     * tailwind-merge keeps alongside `flex-col`, silently centring the local
     * time under the event time instead of putting it beside it.
     */
    orientation: {
      column: "flex-col",
      row: "flex-row items-baseline",
    },
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
    orientation: "column",
    spacing: "default",
    variant: "default",
  },
});

// No letter-spacing on the clock face: the <time> below renders `tabular-nums`,
// whose digits already carry an equalised advance, and every caller sets this at
// body scale (11–16px). Tracking on top of padded digits reads as stretched, and
// makes a time sitting next to a date look a size larger than it is.
const primaryTimeVariants = cva("flex items-baseline gap-2", {
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

/**
 * The local time is a TIME, so it is set as one. Its old default —
 * `9px` bold uppercase at `0.25em` — was the recipe for a machine-written
 * status label, which is why seven of nine call sites re-typed their way out of
 * it in two divergent families. Two steps, named after the job:
 *
 * - `quiet` — a footnote beside the primary time (the common case);
 * - `paired` — the two times carry comparable weight, as on the facts card
 *   where the local reading is a fact the producer works from, not a gloss.
 *
 * `divider` is for the dark pills, where both times sit on ONE line inside a
 * tinted chip and a gap alone does not separate them.
 */
const localTimeVariants = cva(
  "flex items-center gap-1.5 font-medium normal-case tracking-normal",
  {
    variants: {
      variant: {
        default: "text-ethereal-graphite/60",
        dark: "text-ethereal-parchment/70",
      },
      local: {
        quiet: "text-[10px]",
        paired: "text-xs",
      },
      divider: {
        true: "border-l pl-1.5",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "default", local: "paired", class: "text-ethereal-graphite" },
      { variant: "default", divider: true, class: "border-ethereal-graphite/20" },
      { variant: "dark", divider: true, class: "border-ethereal-parchment/30" },
    ],
    defaultVariants: {
      variant: "default",
      local: "quiet",
      divider: false,
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
  /** Weight of the local-time row against the primary — see `localTimeVariants`. */
  local?: VariantProps<typeof localTimeVariants>["local"];
  /** Rule between the two times, for a one-line chip. See `localTimeVariants`. */
  divider?: boolean;
  className?: string;
  containerClassName?: string;
  timeClassName?: string;
  primaryTimeClassName?: string;
}

export const DualTimeDisplay = ({
  value,
  timeZone,
  label,
  icon,
  orientation,
  spacing,
  typography,
  color,
  size,
  weight,
  variant = "default",
  local,
  divider,
  className,
  containerClassName,
  timeClassName,
  primaryTimeClassName,
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

  const localTimeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };

  // Compared by what the reader would actually SEE, not by IANA name.
  // Europe/Paris and Europe/Warsaw are different zones that never differ in
  // offset, so a name comparison printed "01:45 CEST" and, right under it,
  // "01:45 CEST (twój czas)" — the same instant twice, as pure noise.
  const eventRendering = formatLocalizedTime(
    value,
    localTimeOptions,
    undefined,
    eventTimezone,
  );
  const localRendering = formatLocalizedTime(
    value,
    localTimeOptions,
    undefined,
    userTimezone,
  );
  const hasDiffTz = eventRendering !== localRendering;

  const primaryTimeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(hasDiffTz && { timeZoneName: "short" }),
  };

  // Resolve defaults based on variant if not explicitly provided
  const resolvedColor = color || (variant === "dark" ? "dark" : "default");

  return (
    <div
      className={cn(
        containerVariants({ orientation, spacing, variant }),
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
            className={localTimeVariants({
              variant,
              local,
              divider: Boolean(divider),
            })}
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
            {/* An annotation never outweighs the datum: this used to be set at
                12px beside a 9px time. It rides one step under whatever the row
                itself is. */}
            <span
              className={cn(
                "font-sans text-[9px] font-medium lowercase tracking-normal",
                variant === "dark"
                  ? "text-ethereal-parchment/50"
                  : "text-ethereal-graphite/45",
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
