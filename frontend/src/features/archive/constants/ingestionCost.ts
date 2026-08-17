/**
 * @file ingestionCost.ts
 * @description One voice for what an ingestion cost. The pipeline bills in USD
 * cents (Anthropic + lookup APIs), and the archive used to print that three
 * ways on three surfaces — `$0.00` on the live panel, `7¢` on the editions list,
 * `2-5 ¢` in the drawer's copy — which read as three different meters.
 *
 * Sub-dollar runs stay in cents (a real ingestion is ~2-8¢; `$0.04` buries the
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
