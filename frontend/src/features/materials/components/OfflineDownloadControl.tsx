/**
 * @file OfflineDownloadControl.tsx
 * @description Per-concert "download for offline practice" affordance. Pulls
 * every voice track + score into the managed caches so the chorister can rehearse
 * on the train with no signal — the reliable counterpart to passive streaming.
 * Lives in the Songbook project header.
 */
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, CloudDownload, Loader2, RotateCw, Trash2, TriangleAlert } from "lucide-react";

import { Eyebrow } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useOfflineStore } from "@/app/store/useOfflineStore";
import {
  downloadProjectForOffline,
  isServiceWorkerSupported,
  removeProjectFromOffline,
} from "@/shared/offline/offlineClient";
import type { MaterialsDashboardGroup } from "../types/materials.dto";

interface OfflineDownloadControlProps {
  group: MaterialsDashboardGroup;
}

export const OfflineDownloadControl = ({
  group,
}: OfflineDownloadControlProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const projectId = group.project.id;
  const manifest = useOfflineStore((state) => state.manifests[projectId]);
  const progress = useOfflineStore((state) => state.progress[projectId]);
  const clearProgress = useOfflineStore((state) => state.clearProgress);

  const isDownloading = progress?.status === "downloading";
  const isReady = !!manifest && manifest.failed === 0;
  const isPartial = !!manifest && manifest.failed > 0;

  const handleDownload = useCallback(async () => {
    try {
      const outcome = await downloadProjectForOffline(group);
      if (outcome.cached === 0) {
        toast.error(
          t("offline.download.empty", "Brak materiałów do pobrania na offline."),
        );
        return;
      }
      if (outcome.failed > 0) {
        toast.warning(
          t("offline.download.partial", "Pobrano część materiałów — sprawdź połączenie."),
        );
      } else {
        toast.success(
          t("offline.download.ready", "Materiały dostępne offline."),
        );
      }
    } catch {
      clearProgress(projectId);
      toast.error(
        t("offline.download.unavailable", "Tryb offline jest niedostępny na tym urządzeniu."),
      );
    }
  }, [group, projectId, clearProgress, t]);

  const handleEvict = useCallback(async () => {
    await removeProjectFromOffline(projectId);
    toast.success(t("offline.download.removed", "Usunięto materiały offline."));
  }, [projectId, t]);

  // Offline storage needs a service worker — hide the control where unsupported.
  if (!isServiceWorkerSupported()) return null;

  if (isDownloading) {
    const total = progress?.total ?? 0;
    const done = progress?.done ?? 0;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-gold/40 bg-ethereal-gold/10 px-2.5 py-1.5 text-ethereal-gold"
        aria-live="polite"
      >
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        <Eyebrow color="inherit" className="tabular-nums">
          {total > 0
            ? t("offline.download.progress", "Pobieranie {{done}}/{{total}}", { done, total })
            : t("offline.download.starting", "Pobieranie…")}
        </Eyebrow>
      </span>
    );
  }

  if (isReady || isPartial) {
    return (
      <div className="inline-flex items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
            isPartial
              ? "border-ethereal-incense/40 bg-ethereal-incense/10 text-ethereal-incense"
              : "border-ethereal-sage/40 bg-ethereal-sage/10 text-ethereal-sage",
          )}
        >
          {isPartial ? (
            <TriangleAlert size={13} aria-hidden="true" />
          ) : (
            <Check size={13} aria-hidden="true" />
          )}
          <Eyebrow color="inherit">
            {isPartial
              ? t("offline.download.partial_badge", "Częściowo offline")
              : t("offline.download.ready_badge", "Dostępne offline")}
          </Eyebrow>
        </span>
        {isPartial && (
          <button
            type="button"
            onClick={handleDownload}
            aria-label={t("offline.download.retry", "Pobierz ponownie")}
            className="rounded-lg border border-ethereal-marble bg-ethereal-alabaster p-1.5 text-ethereal-graphite shadow-glass-solid transition-all hover:text-ethereal-ink active:scale-95"
          >
            <RotateCw size={13} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={handleEvict}
          aria-label={t("offline.download.remove", "Usuń materiały offline")}
          className="rounded-lg border border-ethereal-marble bg-ethereal-alabaster p-1.5 text-ethereal-graphite shadow-glass-solid transition-all hover:text-ethereal-ink active:scale-95"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-marble bg-ethereal-alabaster px-2.5 py-1.5 text-ethereal-graphite shadow-glass-solid transition-all hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
    >
      <CloudDownload size={13} className="text-ethereal-gold" aria-hidden="true" />
      <Eyebrow color="inherit">
        {t("offline.download.action", "Pobierz na offline")}
      </Eyebrow>
    </button>
  );
};
