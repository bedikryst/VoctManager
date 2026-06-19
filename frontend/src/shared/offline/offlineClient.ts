/**
 * @file offlineClient.ts
 * @description App-thread half of the offline system: registers the service
 * worker for *everyone* (not just push opt-ins), collects a concert's practice
 * assets, drives explicit downloads over a MessageChannel, and replays the
 * offline write queue once the network returns.
 * @module shared/offline/offlineClient
 */

import type { QueryClient } from "@tanstack/react-query";

import api from "@/shared/api/api";
import { getPiecePdfLinks } from "@/features/archive/constants/piecePdfs";
import type { MaterialsDashboardGroup } from "@/features/materials/types/materials.dto";
import {
  useOfflineStore,
  type QueuedWrite,
} from "@/app/store/useOfflineStore";
import {
  type OfflineAsset,
  type OfflineSwReply,
} from "./swProtocol";

const SW_URL = "/sw.js";

export const isServiceWorkerSupported = (): boolean =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator;

/**
 * Registers the SW on app load so offline works regardless of push consent.
 * Idempotent — the push controller calling register() again is a no-op.
 */
export const registerOfflineServiceWorker = async (): Promise<void> => {
  if (!isServiceWorkerSupported() || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (error) {
    // A failed SW registration must never break app boot — offline degrades,
    // the online app is unaffected.
    console.error("[offline] Service worker registration failed:", error);
  }
};

const getActiveWorker = async (): Promise<ServiceWorker | null> => {
  if (!isServiceWorkerSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return registration.active;
  } catch {
    return null;
  }
};

/**
 * Flattens a concert into its downloadable practice assets: every voice track
 * (blend/minus-mine need the whole choir, not just my line) plus the primary
 * score edition of each piece. Deduplicated by URL.
 */
export const collectProjectAssets = (
  group: MaterialsDashboardGroup,
): OfflineAsset[] => {
  const seen = new Set<string>();
  const assets: OfflineAsset[] = [];

  const push = (url: string | null | undefined, kind: OfflineAsset["kind"]) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    assets.push({ url: trimmed, kind });
  };

  for (const item of group.program) {
    for (const track of item.piece.tracks) push(track.audio_file, "audio");
    const primaryScore = getPiecePdfLinks(item.piece)[0];
    if (primaryScore) push(primaryScore.url, "score");
  }

  return assets;
};

interface DownloadOutcome {
  cached: number;
  failed: number;
}

/**
 * Streams a concert's assets into the managed caches via the SW, reporting
 * progress to the store as it goes. Rejects only when the SW is unreachable;
 * per-asset failures are surfaced as `failed` in the resolved outcome.
 */
export const downloadProjectForOffline = async (
  group: MaterialsDashboardGroup,
): Promise<DownloadOutcome> => {
  const worker = await getActiveWorker();
  if (!worker) throw new Error("offline-unavailable");

  const assets = collectProjectAssets(group);
  const projectId = group.project.id;
  const store = useOfflineStore.getState();

  if (assets.length === 0) {
    store.setProgress(projectId, {
      status: "ready",
      done: 0,
      total: 0,
      failed: 0,
    });
    store.saveManifest({
      projectId,
      title: group.project.title,
      assetUrls: [],
      assetCount: 0,
      failed: 0,
      cachedAt: Date.now(),
    });
    return { cached: 0, failed: 0 };
  }

  store.setProgress(projectId, {
    status: "downloading",
    done: 0,
    total: assets.length,
    failed: 0,
  });

  return new Promise<DownloadOutcome>((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event: MessageEvent<OfflineSwReply>) => {
      const message = event.data;
      if (message.type === "VOCT_CACHE_PROGRESS") {
        useOfflineStore.getState().setProgress(projectId, {
          status: "downloading",
          done: message.done,
          total: message.total,
          failed: message.failed,
        });
        return;
      }

      // VOCT_CACHE_DONE
      const status =
        message.cached === 0
          ? "error"
          : message.failed > 0
            ? "partial"
            : "ready";
      const current = useOfflineStore.getState();
      current.setProgress(projectId, {
        status,
        done: assets.length,
        total: assets.length,
        failed: message.failed,
      });
      if (message.cached > 0) {
        current.saveManifest({
          projectId,
          title: group.project.title,
          assetUrls: assets.map((asset) => asset.url),
          assetCount: message.cached,
          failed: message.failed,
          cachedAt: Date.now(),
        });
      }
      channel.port1.close();
      resolve({ cached: message.cached, failed: message.failed });
    };

    worker.postMessage({ type: "VOCT_CACHE_ASSETS", assets }, [channel.port2]);
  });
};

/** Evicts a concert's cached assets and drops its manifest + progress. */
export const removeProjectFromOffline = async (
  projectId: string,
): Promise<void> => {
  const store = useOfflineStore.getState();
  const manifest = store.manifests[projectId];
  store.removeManifest(projectId);
  store.clearProgress(projectId);

  const worker = await getActiveWorker();
  if (worker && manifest && manifest.assetUrls.length > 0) {
    worker.postMessage({ type: "VOCT_EVICT_ASSETS", urls: manifest.assetUrls });
  }
};

/** Wipes every managed cache + manifest + queue (logout). */
export const clearAllOffline = async (): Promise<void> => {
  useOfflineStore.getState().reset();
  const worker = await getActiveWorker();
  worker?.postMessage({ type: "VOCT_CLEAR_OFFLINE" });
};

export interface FlushSummary {
  flushed: number;
  rejected: number;
  remaining: number;
}

/**
 * True when a failed write almost certainly died on the network rather than
 * being rejected by the server — so it's safe to queue and replay later.
 * axios network errors carry no `response`; a genuine 4xx/5xx does.
 */
export const isLikelyOfflineError = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (!("response" in error) ||
      (error as { response?: unknown }).response === undefined)
  );
};

const replayWrite = async (write: QueuedWrite): Promise<void> => {
  await api.request({
    method: write.method,
    url: write.url,
    data: write.body,
  });
};

/**
 * Replays queued writes oldest-first. Stops at the first genuine network
 * failure (still offline — keep the rest); drops writes the server rejects
 * (4xx/5xx) so a poison entry can't wedge the queue forever. Reconciles the
 * affected caches afterwards.
 */
export const flushOfflineQueue = async (
  queryClient: QueryClient,
): Promise<FlushSummary> => {
  const { queue, dequeueWrite } = useOfflineStore.getState();
  if (queue.length === 0) {
    return { flushed: 0, rejected: 0, remaining: 0 };
  }

  let flushed = 0;
  let rejected = 0;

  for (const write of [...queue]) {
    try {
      await replayWrite(write);
      dequeueWrite(write.id);
      flushed += 1;
    } catch (error) {
      if (isLikelyOfflineError(error)) break; // network dropped again — retry later
      dequeueWrite(write.id); // server rejected it — don't retry forever
      rejected += 1;
    }
  }

  if (flushed > 0 || rejected > 0) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["materials", "dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["schedule", "dashboard"] }),
    ]);
  }

  return {
    flushed,
    rejected,
    remaining: useOfflineStore.getState().queue.length,
  };
};
