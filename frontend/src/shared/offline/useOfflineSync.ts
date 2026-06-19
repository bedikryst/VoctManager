/**
 * @file useOfflineSync.ts
 * @description Mounts once in the panel shell. Tracks connectivity, drains the
 * offline write queue the moment the network returns (and on first mount if
 * anything is pending), and exposes a compact status the shell can surface.
 * @module shared/offline/useOfflineSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useOfflineStore } from "@/app/store/useOfflineStore";
import { flushOfflineQueue } from "./offlineClient";

export interface OfflineSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => void;
}

export const useOfflineSync = (): OfflineSyncStatus => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pendingCount = useOfflineStore((state) => state.queue.length);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (useOfflineStore.getState().queue.length === 0) return;

    inFlight.current = true;
    setIsSyncing(true);
    try {
      const summary = await flushOfflineQueue(queryClient);
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
  }, [queryClient, t]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Drain anything left over from a previous session that ended offline.
    void flush();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  const syncNow = useCallback(() => void flush(), [flush]);

  return { isOnline, pendingCount, isSyncing, syncNow };
};
