/**
 * @file ingestionCost.ts
 * @description One voice for what an ingestion cost. The pipeline bills in USD
 * cents (Anthropic + lookup APIs); the live panel, the editions list and the
 * upload drawer all print it through this formatter, in the reader's locale
 * ("1,81 USD" and "0,76 USD" in Polish, "$1.81" in English), so they read as
 * one meter.
 *
 * A zero returns null so callers omit the figure entirely: a cost line that
 * says nothing but "0,00 USD" for the first seconds of every upload is noise on
 * the one row the conductor is watching.
 * @module features/archive/constants/ingestionCost
 */

/** Formatted spend in `locale`, or null when nothing has been billed yet. */
export const formatIngestionCost = (
  cents: number | null | undefined,
  locale: string,
): string | null => {
  const value = cents ?? 0;
  if (value <= 0) return null;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value / 100);
};
