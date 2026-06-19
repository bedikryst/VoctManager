/**
 * @file time.ts
 * @description Conversation time formatting — calm, chat-native stamps. Inbox rows
 * get a compact relative stamp (teraz / 12 min / 14:30 / wczoraj / 12 cze); the
 * stream is sliced into day groups with a human divider label. Locale follows the
 * browser (mirrors the rest of the feature's `toLocaleString(undefined, …)` idiom).
 * @architecture Enterprise SaaS 2026
 * @module features/messages/lib/time
 */

import type { TFunction } from "i18next";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const startOfDay = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days between two instants (today = 0, yesterday = 1). */
const daysApart = (from: Date, to: Date): number =>
  Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);

const timeOnly = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * Compact stamp for inbox rows: relative for the recent past, clock time for the
 * rest of today, then progressively coarser calendar labels.
 */
export const relativeStamp = (iso: string, t: TFunction): string => {
  const then = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - then.getTime();

  if (diff < MINUTE) return t("messages.time.now", "teraz");
  if (diff < HOUR)
    return t("messages.time.minutes", "{{count}} min", {
      count: Math.round(diff / MINUTE),
    });

  const days = daysApart(then, now);
  if (days === 0) return timeOnly(then);
  if (days === 1) return t("messages.time.yesterday", "wczoraj");
  if (days < 7)
    return then.toLocaleDateString(undefined, { weekday: "short" });

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

/** Full timestamp for inside a message bubble (title / hover detail). */
export const fullStamp = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Clock-only stamp shown on a bubble within its day group. */
export const clockStamp = (iso: string): string => timeOnly(new Date(iso));

/** Human divider label for a day group: Dziś / Wczoraj / 12 czerwca [2025]. */
export const dayLabel = (iso: string, t: TFunction): string => {
  const then = new Date(iso);
  const now = new Date();
  const days = daysApart(then, now);

  if (days === 0) return t("messages.time.today", "Dziś");
  if (days === 1) return t("messages.time.yesterday_full", "Wczoraj");

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

export interface DayGroup<T> {
  key: number;
  iso: string;
  items: T[];
}

/**
 * Slices an ordered (oldest→newest) message list into contiguous day groups,
 * preserving order. Each group carries the first message's ISO for its label.
 */
export const groupMessagesByDay = <T extends { created_at: string }>(
  messages: readonly T[],
): DayGroup<T>[] => {
  const groups: DayGroup<T>[] = [];
  for (const item of messages) {
    const key = startOfDay(new Date(item.created_at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, iso: item.created_at, items: [item] });
    }
  }
  return groups;
};

/** True for client-side optimistic placeholders awaiting server confirmation. */
export const isOptimisticId = (id: string): boolean => id.startsWith("optimistic-");
