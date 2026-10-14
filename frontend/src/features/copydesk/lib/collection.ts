/**
 * @file collection.ts
 * @description The collection desk's arithmetic and formatting: whole-złoty
 * money, the hand-typed figure parser, and the share of the goal the vault's
 * rail would draw.
 * @module features/copydesk/lib/collection
 */

import { getIntlLocale } from "@/shared/lib/time/intl";
import type { CollectionDesk, CollectionSource } from "../types/collection.dto";

/** Declaration order of the backend's `OfflineTallySource`, which is the order the desk lists them. */
export const COLLECTION_SOURCES: readonly CollectionSource[] = [
  "ZRZUTKA",
  "BANK_TRANSFER",
  "OTHER",
];

/** Bounds the server enforces on a hand-typed figure (`payments/serializers.py`). */
export const MAX_TALLY_AMOUNT = 10_000_000;
export const MAX_TALLY_DONORS = 100_000;

/**
 * The share of the goal below which the advice is to keep the rail off: a short
 * fill beside an announced concert reads as doubt that the evening will happen.
 * Advice printed beside the switch, never enforced — the editors decide.
 */
export const RAIL_ADVICE_PERCENT = 30;

export const formatPln = (value: number, language: string): string =>
  new Intl.NumberFormat(getIntlLocale(language), {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);

/**
 * A whole non-negative number typed by hand, or null when the text is not one.
 * Whitespace is dropped first, because the figure is copied from panels that
 * group thousands with spaces ("4 000"); JavaScript's `\s` already covers the
 * no-break and narrow no-break spaces `Intl` itself groups with.
 */
export const parseWholeNumber = (input: string): number | null => {
  const digits = input.replace(/\s/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
};

export const effectiveGoal = (desk: CollectionDesk): number =>
  desk.goal ?? desk.default_goal;

/** Whole percent of the goal the site's total reaches, capped at 100. */
export const goalPercent = (desk: CollectionDesk): number => {
  const goal = effectiveGoal(desk);
  if (goal <= 0) return 0;
  return Math.min(100, Math.floor((desk.total.raised / goal) * 100));
};
