/**
 * @file pushTray.ts
 * @description The device's side of keeping the tray and the bell in step. A
 * shown push keeps the in-app rows it speaks for (see `sw.ts`); this closes the
 * entries none of whose rows is still unread, and sets the app-icon badge where
 * the platform has a Badging API. Chrome on Android has none: its launcher dot
 * counts this app's tray entries, so closing them is the only way to clear it.
 * @module features/notifications/lib/pushTray
 */
import { trayNotificationIds } from "@/shared/offline/swProtocol";

import { NotificationService } from "../api/notifications.service";

interface TrayEntry {
  readonly notification: Notification;
  readonly ids: readonly string[];
}

// Ids per unread check, keeping each request's URL short (a UUID is 37
// characters with its comma).
const IDS_PER_CHECK = 40;

/** This app's tray entries that speak for at least one in-app row. */
const trayEntries = async (): Promise<TrayEntry[]> => {
  if (!("serviceWorker" in navigator)) return [];
  // `getRegistration`, not `ready`: `ready` never settles where no worker is
  // registered, which is the dev server.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration || typeof registration.getNotifications !== "function") return [];
  const shown = await registration.getNotifications();
  return shown
    .map((notification) => ({ notification, ids: trayNotificationIds(notification.data) }))
    .filter((entry) => entry.ids.length > 0);
};

/**
 * Closes every tray entry none of whose rows is unread any more — read here, by
 * mark-all, or on another device. The server answers which are unread, not the
 * bell's loaded page: an entry's rows may sit beyond it, and a page fetched a
 * moment before a push landed would call its row read and close the entry
 * announcing it.
 *
 * The tray is listed again once the server has answered, and an entry closes
 * only when every row it speaks for was asked about. A push landing meanwhile
 * may have replaced an entry under its tag, and Chrome keys a tagged entry by
 * the tag: closing the stale object would close its successor, whose new row
 * was never asked about.
 */
export const syncPushTray = async (): Promise<void> => {
  try {
    const entries = await trayEntries();
    if (entries.length === 0) return;
    const ids = [...new Set(entries.flatMap((entry) => entry.ids))];
    const chunks: string[][] = [];
    for (let start = 0; start < ids.length; start += IDS_PER_CHECK) {
      chunks.push(ids.slice(start, start + IDS_PER_CHECK));
    }
    const answers = await Promise.all(
      chunks.map((chunk) => NotificationService.getUnreadAmong(chunk)),
    );
    const asked = new Set(ids);
    const unread = new Set(answers.flat());
    for (const entry of await trayEntries()) {
      if (entry.ids.every((id) => asked.has(id) && !unread.has(id))) entry.notification.close();
    }
  } catch {
    // Best effort: an entry left standing is judged again on the next pass.
  }
};

/** The app-icon count, where the platform has one; a no-op elsewhere. */
export const setAppBadge = async (count: number): Promise<void> => {
  if (!("setAppBadge" in navigator)) return;
  try {
    await (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge());
  } catch {
    // Refused without notification permission (iOS): only the count is missing.
  }
};

/** At logout the badge and the tray entries belong to a session that ended. */
export const clearPushTray = async (): Promise<void> => {
  await setAppBadge(0);
  try {
    for (const entry of await trayEntries()) entry.notification.close();
  } catch {
    // Nothing to undo: the entries simply stay until tapped or swiped.
  }
};
