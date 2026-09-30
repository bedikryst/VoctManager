/**
 * @file notificationFold.ts
 * @description Which bell rows speak as one. A singer's burst of attendance
 * reports (one artist, within half an hour) and the messages of one thread each
 * render as a single row over all of them; every other row stands alone.
 * `ABSENCE_REQUESTED` never folds: each one waits for its own decision. The
 * caller folds each read state separately, so the unread section holds only
 * what is new and a thread's history does not climb back above it.
 * @module features/notifications/lib
 */

import type { NotificationDTO } from "../types/notifications.dto";

/** How far a singer's attendance report may lie from the newest one in its
 *  burst and still belong to it: one sitting with the schedule, with a pause to
 *  check a calendar. The push folds on a much shorter window because it holds a
 *  push back while it waits; the bell holds nothing back. */
export const ATTENDANCE_FOLD_WINDOW_MS = 30 * 60_000;

export interface BellEntry {
  /** The newest row. Its id keys the entry, its time dates it. */
  lead: NotificationDTO;
  /** Every row the entry speaks for, newest first, the lead included. */
  members: NotificationDTO[];
}

const foldKey = (notification: NotificationDTO): string | undefined => {
  if (notification.notification_type === "MESSAGE_RECEIVED") {
    const threadId = notification.metadata.thread_id;
    return threadId ? `thread:${threadId}` : undefined;
  }
  if (notification.notification_type === "ATTENDANCE_SUBMITTED") {
    const artistId = notification.metadata.artist_id;
    return artistId ? `attendance:${artistId}` : undefined;
  }
  return undefined;
};

/** A thread holds all its rows; a burst only the reports close to its newest. */
const belongs = (entry: BellEntry, candidate: NotificationDTO): boolean =>
  candidate.notification_type !== "ATTENDANCE_SUBMITTED" ||
  Date.parse(entry.lead.created_at) - Date.parse(candidate.created_at) <=
    ATTENDANCE_FOLD_WINDOW_MS;

/**
 * The rows as bell entries, in the order given (newest first, as the feed
 * serves them). An entry sits where its newest row would have.
 */
export const foldNotifications = (
  items: readonly NotificationDTO[],
): BellEntry[] => {
  const entries: BellEntry[] = [];
  const open = new Map<string, BellEntry>();
  for (const item of items) {
    const key = foldKey(item);
    const entry = key ? open.get(key) : undefined;
    if (entry && belongs(entry, item)) {
      entry.members.push(item);
      continue;
    }
    const fresh: BellEntry = { lead: item, members: [item] };
    entries.push(fresh);
    if (key) open.set(key, fresh);
  }
  return entries;
};
