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

/**
 * The manifest's scope, and it must stay inside it. Chrome on Android credits a
 * notification to the installed app — its icon in the tray, its count on the
 * launcher — only when the worker that shows it is registered within the app's
 * scope; a worker at "/" posts every push as Chrome itself.
 */
const SW_SCOPE = "/panel";

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
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    armAppUpdateWatch(registration);
    return registration;
  } catch (error) {
    // A failed SW registration must never break app boot — offline degrades,
    // the online app is unaffected.
    console.error("[offline] Service worker registration failed:", error);
    return null;
  }
};

/**
 * Resolves once the registration has an active worker, or null if its first
 * install fails. A fresh install precaches the whole shell before it activates.
 */
const whenActive = (
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration | null> =>
  new Promise((resolve) => {
    if (registration.active) {
      resolve(registration);
      return;
    }
    const worker = registration.installing ?? registration.waiting;
    if (!worker) {
      resolve(null);
      return;
    }
    const onStateChange = (): void => {
      if (!registration.active && worker.state !== "redundant") return;
      worker.removeEventListener("statechange", onStateChange);
      resolve(registration.active ? registration : null);
    };
    worker.addEventListener("statechange", onStateChange);
  });

/**
 * The app's registration once its worker is active: push subscribes against an
 * active worker only, and downloads are messaged to it. Deliberately not
 * `navigator.serviceWorker.ready`, which settles once per page on whichever
 * registration controlled it first — on a device still holding the worker at
 * "/", that is the old one. Null wherever service workers are unavailable.
 */
export const getActiveServiceWorkerRegistration =
  async (): Promise<ServiceWorkerRegistration | null> => {
    const registration = await ensureRegistration();
    return registration ? whenActive(registration) : null;
  };

/**
 * The registration this app held at "/" before every route moved under
 * `/panel`, on a device that has not given it up yet. Push subscriptions made
 * then are bound to it.
 */
export const getRootServiceWorkerRegistration =
  async (): Promise<ServiceWorkerRegistration | null> => {
    if (!isServiceWorkerSupported()) return null;
    try {
      return (await navigator.serviceWorker.getRegistration("/")) ?? null;
    } catch {
      return null;
    }
  };

/**
 * Unregisters the root worker and deletes the precache it filled. Workbox
 * suffixes a precache name with its registration's scope, and nothing else
 * would ever delete this one.
 */
export const retireRootServiceWorker = async (
  root: ServiceWorkerRegistration,
): Promise<void> => {
  const scope = root.scope;
  if (!(await root.unregister())) return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.includes("-precache-") && name.endsWith(scope))
      .map((name) => caches.delete(name)),
  );
};

/**
 * Registers the SW on app load so offline works regardless of push consent, and
 * retires the root worker once this one is active, so the device is never left
 * without a worker that boots the app offline. A root worker holding a push
 * subscription is left for the push feature, which moves the subscription first.
 */
export const registerOfflineServiceWorker = async (): Promise<void> => {
  if (!(await getActiveServiceWorkerRegistration())) return;
  const root = await getRootServiceWorkerRegistration();
  if (!root) return;
  try {
    // `pushManager` is absent where the browser has no Push API (iOS outside the
    // installed app).
    const subscription = "pushManager" in root ? await root.pushManager.getSubscription() : null;
    if (!subscription) await retireRootServiceWorker(root);
  } catch {
    /* The root worker stays; the next session tries again. */
  }
};

const getActiveWorker = async (): Promise<ServiceWorker | null> => {
  try {
    return (await getActiveServiceWorkerRegistration())?.active ?? null;
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
  // A background write settles like any other, but the summary only counts
  // what the reader would recognise as their own change.
  const counted = (write: QueuedWrite): number => (write.background ? 0 : 1);

  for (const write of queue) {
    if (!force && write.nextAttemptAt > Date.now()) break;
    // Withdrawn or superseded by the reader while an earlier replay was in the air.
    if (!store().queue.some((item) => item.id === write.id)) continue;

    store().startAttempt(write.id);
    try {
      await replayWrite(write);
      store().dequeueWrite(write.id);
      flushed += counted(write);
      settledKinds.add(write.kind);
      continue;
    } catch (error) {
      const verdict = classifyWriteFailure(error, write.method);
      if (verdict === "done") {
        store().dequeueWrite(write.id);
        flushed += counted(write);
        settledKinds.add(write.kind);
        continue;
      }
      if (verdict === "reject") {
        store().dequeueWrite(write.id);
        rejected += counted(write);
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
