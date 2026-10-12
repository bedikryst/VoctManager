/**
 * @file ingestionCost.ts
 * @description One voice for what an ingestion cost. The pipeline bills in USD
 * cents (Anthropic + lookup APIs), and the live panel, the editions list and the
 * upload drawer's copy all print it in cents, so they read as one meter.
 *
 * Sub-dollar runs stay in cents (a real ingestion is ~4-20¢; `$0.07` buries the
 * only digit that varies), and a zero returns null so callers omit the figure
 * entirely: a cost line that says nothing but "$0.00" for the first seconds of
 * every upload is noise on the one row the conductor is watching.
 * @module features/archive/constants/ingestionCost
 */

/** Formatted spend, or null when nothing has been billed yet. */
export const formatIngestionCost = (
  cents: number | null | undefined,
): string | null => {
  const value = cents ?? 0;
  if (value <= 0) return null;
  if (value < 100) return `${value}¢`;
  return `$${(value / 100).toFixed(2)}`;
};
