/**
 * @file formatters.ts
 * @description Pure formatting functions bound to the Design System variants.
 * @architecture Enterprise SaaS 2026
 */

import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "../../../../shared/lib/intl";

export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const isDifferentTimezone = (eventTimeZone?: string | null): boolean => {
  if (!eventTimeZone) return false;
  return eventTimeZone !== getUserTimezone();
};

type DateFormatVariant = "default" | "short" | "compact";

const DATE_VARIANTS: Record<DateFormatVariant, Intl.DateTimeFormatOptions> = {
  default: { year: "numeric", month: "long", day: "numeric", weekday: "long" },
  short: { month: "short", day: "numeric" },
  compact: { year: "numeric", month: "2-digit", day: "2-digit" },
};

export const formatDate = (
  dateString: string | undefined | null,
  timeZone?: string | null,
  variant: DateFormatVariant = "default",
): string => {
  return formatLocalizedDate(dateString, {
    ...DATE_VARIANTS[variant],
    ...(timeZone && { timeZone }),
  });
};

export const formatEventTime = (
  dateString: string | undefined | null,
  timeZone?: string | null,
  includeTimezoneSuffix: boolean = false,
): string => {
  return formatLocalizedTime(dateString, {
    hour: "2-digit",
    minute: "2-digit",
    ...(includeTimezoneSuffix && { timeZoneName: "short" }),
    ...(timeZone && { timeZone }),
  });
};

export const formatUserLocalTime = (
  dateString: string | undefined | null,
): string => {
  return formatLocalizedTime(dateString, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
