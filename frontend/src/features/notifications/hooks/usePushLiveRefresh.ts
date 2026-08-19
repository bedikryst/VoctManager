/**
 * @file usePushLiveRefresh.ts
 * @description Turns an incoming push into an immediate cache reconcile for the
 * open panel. The service worker learns about server-side change before any
 * polled query does; without this bridge the reader gets a banner about a
 * message the panel keeps refusing to show until its next tick. Mounted once in
 * the shell, so it covers every route the reader can be standing on.
 * @architecture Enterprise SaaS 2026
 * @module notifications/hooks/usePushLiveRefresh
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { messagingKeys } from "@/features/messages/api/messages.queries";
import type { SwBroadcast } from "@/shared/offline/swProtocol";

import { notificationKeys } from "../api/notifications.queries";

/**
 * Push types whose content lives in the messaging caches. `messagingKeys.all`
 * covers project channels too — their keys are nested under it.
 */
const MESSAGING_PUSH_TYPES: ReadonlySet<string> = new Set([
  "MESSAGE_RECEIVED",
  "CHANNEL_MESSAGE",
]);

export const usePushLiveRefresh = (): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as SwBroadcast | undefined;
      if (data?.type !== "VOCT_PUSH_RECEIVED") return;

      // Every push means the bell has something new to say.
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      if (MESSAGING_PUSH_TYPES.has(data.notificationType)) {
        void queryClient.invalidateQueries({ queryKey: messagingKeys.all });
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [queryClient]);
};
