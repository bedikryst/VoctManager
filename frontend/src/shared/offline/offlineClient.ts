/**
 * @file offlineClient.ts
 * @description App-thread half of the offline system: registers the service
 * worker for *everyone* (not just push opt-ins), drives explicit downloads over
 * a MessageChannel, and replays the offline write queue once the network
 * returns. Which assets make up a concert, and which caches a landed write
 * makes stale, belong to the features — they hand this module the list and
 * register their reconcilers.
 * @module shared/offline/offlineClient
 */

import type { QueryClient } from "@tanstack/react-query";

import api from "@/shared/api/api";
import { armAppUpdateWatch } from "@/shared/pwa/appUpdateController";
import {
  useOfflineStore,
  type OfflineWriteKind,
  type QueuedWrite,
} from "./useOfflineStore";
import {
  classifyWriteFailure,
  GIVE_UP_AFTER_MS,
  retryDelayMs,
  statusOf,
} from "./replayPolicy";
import {
  type OfflineAsset,
  type OfflineSwReply,
} from "./swProtocol";

const SW_URL = "/sw.js";

export const isServiceWorkerSupported = (): boolean =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator;

/**
 * Registers the SW (idempotently — same URL and scope resolve to the existing
 * registration) and arms the build-handover watch on it. THE single registration
 * path: push used to call `register()` with its own copy of the URL, which was
 * harmless but meant a second literal that could drift, and left the update
 * watch depending on which caller happened to run first.
 */
const ensureRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isServiceWorkerSupported() || !window.isSecureContext) return null;
  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    armAppUpdateWatch(registration);
    return registration;
  } catch (error) {
    // A failed SW registration must never break app boot — offline degrades,
    // the online app is unaffected.
    console.error("[offline] Service worker registration failed:", error);
    return null;
  }
};

/** Registers the SW on app load so offline works regardless of push consent. */
export const registerOfflineServiceWorker = async (): Promise<void> => {
  await ensureRegistration();
};

/**
 * The registration, for callers that need the object itself (push subscribes
 * against `registration.pushManager`). Resolves to null wherever service workers
 * are unavailable — every caller must handle that rather than assume.
 */
export const getServiceWorkerRegistration =
  async (): Promise<ServiceWorkerRegistration | null> => ensureRegistration();

const getActiveWorker = async (): Promise<ServiceWorker | null> => {
  if (!isServiceWorkerSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return registration.active;
  } catch {
    return null;
  }
};

interface DownloadOutcome {
  cached: number;
  failed: number;
}

/** The concert a download belongs to, as the manifest records it. */
export interface OfflineProjectRef {
  id: string;
  title: string;
}

/**
 * Streams a concert's assets into the managed caches via the SW, reporting
 * progress to the store as it goes. Rejects only when the SW is unreachable;
 * per-asset failures are surfaced as `failed` in the resolved outcome.
 */
export const downloadProjectForOffline = async (
  project: OfflineProjectRef,
  assets: readonly OfflineAsset[],
): Promise<DownloadOutcome> => {
  const worker = await getActiveWorker();
  if (!worker) throw new Error("offline-unavailable");

  const projectId = project.id;
  const store = useOfflineStore.getState();
  // What this device held a moment ago, so the parts of it that are no longer
  // part of the concert can be dropped. The binder makes this matter: it is
  // stored under a URL that names its build, so without this every rebuild
  // would leave its predecessor — the single largest file here — on the phone
  // for a month.
  const previousUrls = store.manifests[projectId]?.assetUrls ?? [];
  const dropSuperseded = (kept: readonly string[]): void => {
    const keep = new Set(kept);
    const stale = previousUrls.filter((url) => !keep.has(url));
    if (stale.length > 0) {
      worker.postMessage({ type: "VOCT_EVICT_ASSETS", urls: stale });
    }
  };

  if (assets.length === 0) {
    dropSuperseded([]);
    store.setProgress(projectId, {
      status: "ready",
      done: 0,
      total: 0,
      failed: 0,
    });
    store.saveManifest({
      projectId,
      title: project.title,
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
        const urls = assets.map((asset) => asset.url);
        // Only once something new is actually on the device: a download that
        // failed outright must not take the copy they already had with it.
        dropSuperseded(urls);
        current.saveManifest({
          projectId,
          title: project.title,
          assetUrls: urls,
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
 * Re-reads whatever a feature's caches showed from the queue, once the queue
 * has let go of one of its writes (landed, refused, or given up on).
 */
export type OfflineReconciler = (queryClient: QueryClient) => Promise<unknown>;

const reconcilers = new Map<OfflineWriteKind, OfflineReconciler>();

/**
 * A feature names what to re-read after its queued writes settle. The app
 * registers every feature's reconciler at boot, before the first flush: a write
 * left over from a session that ended offline is replayed on mount, often long
 * before the screen that queued it is loaded again.
 */
export const registerOfflineReconciler = (
  kind: OfflineWriteKind,
  reconcile: OfflineReconciler,
): void => {
  reconcilers.set(kind, reconcile);
};

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

export interface FlushOptions {
  /**
   * Ignore every write's backoff — the reader pressed "sync now", and a person
   * asking is a better signal than the timer's guess.
   */
  force?: boolean;
}

/**
 * Replays queued writes oldest-first, one at a time, by the rules in
 * `replayPolicy`:
 *   · a write that lands, or whose purpose the answer shows is already met,
 *     leaves the queue;
 *   · a write the server refuses for good leaves it, and is counted as rejected;
 *   · network and server trouble keep the write, schedule its next try, and stop
 *     the loop — the writes behind it may depend on it — until the server has
 *     answered it badly for a whole day, when it is given up on.
 * The loop also stops at a write whose next try is not due yet, for the same
 * reason. Each kind whose writes left the queue is reconciled afterwards.
 *
 * Order is load-bearing for score markings: a mark's create must reach the
 * server before the edit or erase that follows it, and a clear must land after
 * everything it is meant to wipe. Never parallelise this loop.
 */
export const flushOfflineQueue = async (
  queryClient: QueryClient,
  { force = false }: FlushOptions = {},
): Promise<FlushSummary> => {
  const store = useOfflineStore.getState;
  const queue = store().queue;
  if (queue.length === 0) {
    return { flushed: 0, rejected: 0, remaining: 0 };
  }

  let flushed = 0;
  let rejected = 0;
  const settledKinds = new Set<OfflineWriteKind>();

  for (const write of queue) {
    if (!force && write.nextAttemptAt > Date.now()) break;
    // Withdrawn or superseded by the reader while an earlier replay was in the air.
    if (!store().queue.some((item) => item.id === write.id)) continue;

    store().startAttempt(write.id);
    try {
      await replayWrite(write);
      store().dequeueWrite(write.id);
      flushed += 1;
      settledKinds.add(write.kind);
      continue;
    } catch (error) {
      const verdict = classifyWriteFailure(error, write.method);
      if (verdict === "done") {
        store().dequeueWrite(write.id);
        flushed += 1;
        settledKinds.add(write.kind);
        continue;
      }
      if (verdict === "reject") {
        store().dequeueWrite(write.id);
        rejected += 1;
        settledKinds.add(write.kind);
        continue;
      }

      const failedAt = Date.now();
      const answered = statusOf(error) !== null;
      const failingSince = answered
        ? (write.failingSince ?? failedAt)
        : write.failingSince;
      if (answered && failingSince !== null && failedAt - failingSince >= GIVE_UP_AFTER_MS) {
        store().dequeueWrite(write.id);
        rejected += 1;
        settledKinds.add(write.kind);
        continue;
      }
      store().deferWrite(write.id, {
        nextAttemptAt: failedAt + retryDelayMs(write.attempts + 1),
        failingSince,
      });
      break;
    }
  }

  await Promise.all(
    [...settledKinds].map((kind) =>
      reconcilers.get(kind)?.(queryClient).catch(() => {}),
    ),
  );

  return {
    flushed,
    rejected,
    remaining: store().queue.length,
  };
};
