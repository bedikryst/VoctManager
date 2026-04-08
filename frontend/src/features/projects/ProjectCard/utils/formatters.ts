/**
 * @file formatters.ts
 * @description Pure functions for data formatting within the Project Card.
 * @architecture Enterprise SaaS 2026
 */

import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "../../../../shared/lib/intl";

export const formatDate = (dateString: string | undefined | null): string => {
  return formatLocalizedDate(dateString, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
};

export const formatTime = (dateString: string | undefined | null): string => {
  return formatLocalizedTime(dateString, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
