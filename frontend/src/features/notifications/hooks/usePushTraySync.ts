/**
 * @file usePushTraySync.ts
 * @description Keeps the device's tray and app-icon badge in step with the bell.
 * Whenever the unread count moves — a row read here, mark-all, a read on another
 * device noticed by the poll, a push landing — the badge takes the new count and
 * the tray entries whose rows are all read are closed. Returning to the app
 * checks the tray again, since reads elsewhere can leave the count where it was.
 * Mounted once in the panel shell.
 * @module features/notifications/hooks/usePushTraySync
 */
import { useEffect } from "react";

import { useAuth } from "@/app/providers/AuthProvider";

import { useUnreadNotificationCount } from "../api/notifications.queries";
import { setAppBadge, syncPushTray } from "../lib/pushTray";

export const usePushTraySync = (): void => {
  const { user } = useAuth();
  const { data } = useUnreadNotificationCount(!!user);
  const unread = data?.unread_count;

  useEffect(() => {
    if (unread === undefined) return;
    void setAppBadge(unread);
    void syncPushTray();
  }, [unread]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncPushTray();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
};
