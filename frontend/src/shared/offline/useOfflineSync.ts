/**
 * @file useOfflineSync.ts
 * @description Mounts once in the panel shell. Tracks connectivity, drains the
 * offline write queue whenever there is a reason to think it can move — the
 * network returns, the app comes back to the foreground, it mounts with
 * anything pending, and on a timer while anything is queued — and exposes a
 * compact status the shell can surface.
 *
 * The timer is what makes a write that met a server error (a deploy's 502)
 * land without the reader doing anything: no `online` event will ever fire for
 * it, because the network never went away. Each write's own backoff decides
 * whether a tick actually sends it.
 * @module shared/offline/useOfflineSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useOfflineStore } from "./useOfflineStore";
import { flushOfflineQueue } from "./offlineClient";

/** How often a non-empty queue checks whether its first write is due again. */
const RETRY_TICK_MS = 15_000;

export interface OfflineSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  /**
   * Writes the server has answered with an error at least once: waiting on the
   * server rather than on signal, which is a different sentence to the reader.
   */
  stuckCount: number;
  isSyncing: boolean;
  syncNow: () => void;
}

export const useOfflineSync = (): OfflineSyncStatus => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Background writes still keep the drain timer running, but the reader is
  // only told about changes they made.
  const queuedCount = useOfflineStore((state) => state.queue.length);
  const pendingCount = useOfflineStore(
    (state) => state.queue.filter((write) => !write.background).length,
  );
  const stuckCount = useOfflineStore(
    (state) =>
      state.queue.filter((write) => !write.background && write.failingSince !== null)
        .length,
  );

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const inFlight = useRef(false);

  const flush = useCallback(
    async (force = false) => {
      if (inFlight.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (useOfflineStore.getState().queue.length === 0) return;

      inFlight.current = true;
      setIsSyncing(true);
      try {
        const summary = await flushOfflineQueue(queryClient, { force });
        if (summary.flushed > 0) {
          toast.success(
            t("offline.sync.flushed", "Zsynchronizowano zmiany zapisane offline."),
          );
        }
        if (summary.rejected > 0) {
          toast.error(
            t("offline.sync.rejected", "Część zmian offline została odrzucona przez serwer."),
          );
        }
      } finally {
        inFlight.current = false;
        setIsSyncing(false);
      }
    },
    [queryClient, t],
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void flush();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    // Drain anything left over from a previous session that ended offline.
    void flush();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flush]);

  const hasQueued = queuedCount > 0;
  useEffect(() => {
    if (!hasQueued || !isOnline) return;
    const timer = window.setInterval(() => void flush(), RETRY_TICK_MS);
    return () => window.clearInterval(timer);
  }, [flush, hasQueued, isOnline]);

  const syncNow = useCallback(() => void flush(true), [flush]);

  return { isOnline, pendingCount, stuckCount, isSyncing, syncNow };
};
