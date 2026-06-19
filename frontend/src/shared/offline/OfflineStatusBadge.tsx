/**
 * @file OfflineStatusBadge.tsx
 * @description Quiet, self-hiding shell indicator. Appears only when the
 * chorister is offline or has writes waiting to sync, so day-to-day online use
 * never sees it. Driven by {@link useOfflineSync}.
 * @module shared/offline/OfflineStatusBadge
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CloudOff, Loader2, RefreshCw, WifiOff } from "lucide-react";

import { Eyebrow } from "@/shared/ui/primitives/typography";
import type { OfflineSyncStatus } from "./useOfflineSync";

export const OfflineStatusBadge = ({
  isOnline,
  pendingCount,
  isSyncing,
  syncNow,
}: OfflineSyncStatus): React.JSX.Element => {
  const { t } = useTranslation();
  const hasPending = pendingCount > 0;
  const visible = !isOnline || hasPending;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none flex w-full justify-center px-4"
        >
          <div
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-ethereal-ink/90 px-3.5 py-2 shadow-glass-ethereal backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            {!isOnline ? (
              <WifiOff size={14} className="text-ethereal-incense" aria-hidden="true" />
            ) : isSyncing ? (
              <Loader2 size={14} className="animate-spin text-ethereal-gold" aria-hidden="true" />
            ) : (
              <CloudOff size={14} className="text-ethereal-gold" aria-hidden="true" />
            )}

            <Eyebrow color="parchment">
              {!isOnline
                ? hasPending
                  ? t("offline.badge.offline_pending", "Offline · {{count}} do synchronizacji", {
                      count: pendingCount,
                    })
                  : t("offline.badge.offline", "Tryb offline")
                : isSyncing
                  ? t("offline.badge.syncing", "Synchronizacja…")
                  : t("offline.badge.pending", "{{count}} zmian czeka na synchronizację", {
                      count: pendingCount,
                    })}
            </Eyebrow>

            {isOnline && hasPending && !isSyncing && (
              <button
                type="button"
                onClick={syncNow}
                aria-label={t("offline.badge.sync_now", "Synchronizuj teraz")}
                className="ml-0.5 rounded-full p-1 text-ethereal-marble transition-colors hover:text-white"
              >
                <RefreshCw size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
