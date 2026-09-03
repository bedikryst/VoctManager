/**
 * @file intl.ts
 * @description Enterprise-grade internationalization utilities with explicit timezone support.
 */
import i18n from "@/shared/config/i18n";

type DateInput = Date | string | number | null | undefined;

const DEFAULT_LOCALE = "en-US";

const normalizeLanguage = (language?: string): string => {
  const candidate = language || i18n.resolvedLanguage || i18n.language || "en";
  return candidate.split("-")[0];
};

const toValidDate = (value: DateInput): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getIntlLocale = (language?: string): string =>
  i18n.t("common.locale", {
    lng: normalizeLanguage(language),
    defaultValue: DEFAULT_LOCALE,
  });

const formatDateValue = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  language?: string,
  timeZone?: string,
): string => {
  const date = toValidDate(value);
  if (!date) return "";

  // Inject target timezone if provided; otherwise fall back to user's browser default
  const formatOptions: Intl.DateTimeFormatOptions = timeZone
    ? { ...options, timeZone }
    : options;

  return new Intl.DateTimeFormat(getIntlLocale(language), formatOptions).format(
    date,
  );
};

export const formatLocalizedTime = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short", // e.g., "GMT", "CET" - crucial for clarity in travel apps
  },
  language?: string,
  timeZone?: string,
): string => formatDateValue(value, options, language, timeZone);

export const formatLocalizedDate = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZoneName: "short",
  },
  language?: string,
  timeZone?: string,
): string => formatDateValue(value, options, language, timeZone);

export const formatLocalizedDateTime = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  },
  language?: string,
  timeZone?: string,
): string => formatDateValue(value, options, language, timeZone);

/**
 * "2 hours ago" / "za 5 minut", in the reader's language.
 *
 * The one copy: the notification bell and the copy desk's review queue both
 * date somebody's action relative to now, and a second private ladder would put
 * two answers on screen for the same moment. It reads the clock at call time,
 * so a surface that must stay honest over a long sitting re-renders on a
 * ticking `useNow` rather than memoising this.
 */
export const formatRelativeTime = (
  value: DateInput,
  language?: string,
): string => {
  const date = toValidDate(value);
  if (!date) return "";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const distance = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(getIntlLocale(language), {
    numeric: "auto",
  });

  if (distance < 60) return formatter.format(seconds, "second");
  if (distance < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (distance < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (distance < 2592000) return formatter.format(Math.round(seconds / 86400), "day");
  if (distance < 31536000) {
    return formatter.format(Math.round(seconds / 2592000), "month");
  }
  return formatter.format(Math.round(seconds / 31536000), "year");
};

export const isDifferentTimezone = (targetTimeZone?: string): boolean => {
  if (!targetTimeZone) return false;
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return targetTimeZone !== userTimezone;
  } catch (error) {
    // Graceful fallback if browser doesn't support resolvedOptions().timeZone
    return false;
  }
};
