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
  OFFLINE_CACHES,
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

/**
 * Wipes every managed cache, manifest and queued write, and the owner with them.
 * The page deletes the caches itself — they are the origin's, not the worker's —
 * so the wipe is done when this resolves, with no wait on a worker that may still
 * be installing. Never rejects: the store is already empty by then, and a cache
 * that refused to go is the most a failure can leave.
 */
export const clearAllOffline = async (): Promise<void> => {
  useOfflineStore.getState().reset();
  if (typeof caches === "undefined") return;
  await Promise.all(OFFLINE_CACHES.map((name) => caches.delete(name).catch(() => false)));
};

/**
 * Hands this device's offline state to the account that has just been resolved.
 * Called before the shell mounts, because the shell's first act is to drain the
 * queue: a write queued under one account and replayed under another becomes
 * theirs — a personal note filed in their name, their read pointer moved.
 *
 *   · the same account keeps everything;
 *   · another account gets a clean device: queue, downloads and cached lists go;
 *   · state with no recorded owner was written by a build that did not stamp
 *     one. A continuing session (`signedIn: false`) adopts it — it was made
 *     under this very session. A fresh sign-in cannot tell whose it is, so it
 *     is wiped.
 *
 * Resolves true when another account's state was wiped, so the caller can drop
 * whatever else the app keeps per account.
 */
export const claimOfflineState = async (
  userId: string,
  { signedIn }: { signedIn: boolean },
): Promise<boolean> => {
  // Another tab may have signed someone in since this one last read storage.
  await useOfflineStore.persist.rehydrate();
  const { owner, setOwner } = useOfflineStore.getState();
  if (owner === userId) return false;
  if (owner === null && !signedIn) {
    setOwner(userId);
    return false;
  }
  await clearAllOffline();
  useOfflineStore.getState().setOwner(userId);
  return true;
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
 * What a feature does the moment one of its queued writes is accepted, before
 * the write leaves the queue. A feature that draws the queue's echo on the page
 * puts the server's answer in its cache here, or the row would vanish between
 * leaving the queue and the reconcile after the loop. `data` is the response
 * body, or undefined when the answer showed the write's purpose already met.
 *
 * Returns false when the answer met only part of the write; the write is then
 * counted as refused.
 */
export type OfflineLanding = (
  queryClient: QueryClient,
  write: QueuedWrite,
  data: unknown,
) => boolean;

const landings = new Map<OfflineWriteKind, OfflineLanding>();

export const registerOfflineLanding = (
  kind: OfflineWriteKind,
  land: OfflineLanding,
): void => {
  landings.set(kind, land);
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

/**
 * How long one replay may take before it counts as a network failure. Without
 * it a single hung request holds the drain — and every write behind it — for as
 * long as the socket stays open.
 */
export const REPLAY_TIMEOUT_MS = 30_000;

const replayWrite = async (write: QueuedWrite): Promise<unknown> => {
  const response = await api.request({
    method: write.method,
    url: write.url,
    data: write.body,
    timeout: REPLAY_TIMEOUT_MS,
  });
  return response?.data;
};

/** One drain at a time across every tab and the installed app. */
const DRAIN_LOCK = "voct-offline-drain";

/**
 * Runs `drain` under the cross-tab lock, or resolves null without running it
 * when another tab holds it. Where the browser has no Web Locks, the tab drains
 * on its own, as a single tab always could.
 */
const underDrainLock = async <T>(drain: () => Promise<T>): Promise<T | null> => {
  const locks =
    typeof navigator !== "undefined" && "locks" in navigator ? navigator.locks : undefined;
  if (!locks) return drain();
  return locks.request(DRAIN_LOCK, { ifAvailable: true }, (lock) =>
    lock ? drain() : null,
  );
};

export interface FlushOptions {
  /**
   * Ignore every write's backoff — the reader pressed "sync now", and a person
   * asking is a better signal than the timer's guess.
   */
  force?: boolean;
}

/**
 * Replays the signed-in account's queued writes oldest-first, one at a time, by
 * the rules in `replayPolicy`:
 *   · a write that lands, or whose purpose the answer shows is already met,
 *     leaves the queue;
 *   · a write the server refuses for good leaves it, and is counted as rejected;
 *   · a server error keeps the write, schedules its next try, and holds the
 *     writes of its kind behind it — they may depend on it — until the server
 *     has answered it badly for a whole day, when it is given up on. Other kinds
 *     go on: a readiness write stuck on one endpoint says nothing about a mark;
 *   · a network error keeps the write and ends the drain, since nothing behind
 *     it would get through either.
 * A write whose next try is not due yet holds its kind the same way. A
 * background write holds nothing: the reader's own changes never wait behind
 * bookkeeping. Each kind whose writes left the queue is reconciled afterwards.
 *
 * Order within a kind is load-bearing for score markings: a mark's create must
 * reach the server before the edit or erase that follows it, and a clear must
 * land after everything it is meant to wipe. Never parallelise this loop.
 *
 * One tab drains at a time; a call made while another tab is draining returns
 * at once, and that tab reports what it sent.
 */
export const flushOfflineQueue = async (
  queryClient: QueryClient,
  { force = false }: FlushOptions = {},
): Promise<FlushSummary> => {
  const store = useOfflineStore.getState;
  if (store().queue.length === 0) {
    return { flushed: 0, rejected: 0, remaining: 0 };
  }
  const summary = await underDrainLock(() => drainQueue(queryClient, force));
  return summary ?? { flushed: 0, rejected: 0, remaining: store().queue.length };
};

const drainQueue = async (
  queryClient: QueryClient,
  force: boolean,
): Promise<FlushSummary> => {
  const store = useOfflineStore.getState;
  // The tab that held the lock before this one has just rewritten the queue.
  await useOfflineStore.persist.rehydrate();
  const { queue, owner } = store();
  // Nobody has claimed the queue yet; it waits for `claimOfflineState`.
  if (owner === null) return { flushed: 0, rejected: 0, remaining: queue.length };

  let flushed = 0;
  let rejected = 0;
  const settledKinds = new Set<OfflineWriteKind>();
  const heldKinds = new Set<OfflineWriteKind>();
  // A background write settles like any other, but the summary only counts
  // what the reader would recognise as their own change.
  const counted = (write: QueuedWrite): number => (write.background ? 0 : 1);
  const hold = (write: QueuedWrite): void => {
    if (!write.background) heldKinds.add(write.kind);
  };
  const settle = (write: QueuedWrite, outcome: "flushed" | "rejected"): void => {
    store().dequeueWrite(write.id);
    if (outcome === "flushed") flushed += counted(write);
    else rejected += counted(write);
    settledKinds.add(write.kind);
  };

  for (const write of queue) {
    if (heldKinds.has(write.kind)) continue;
    // Withdrawn or superseded by the reader while an earlier replay was in the air.
    if (!store().queue.some((item) => item.id === write.id)) continue;
    // Made under an account that is not the one signed in: never sent as theirs.
    // An unstamped write comes from a tab still running an older build, under
    // the session this tab shares with it.
    if (write.userId !== null && write.userId !== owner) {
      store().dequeueWrite(write.id);
      continue;
    }
    if (!force && write.nextAttemptAt > Date.now()) {
      hold(write);
      continue;
    }

    store().startAttempt(write.id);
    let landed: { data: unknown } | null = null;
    let failure: unknown = null;
    try {
      landed = { data: await replayWrite(write) };
    } catch (error) {
      failure = error;
    }

    const verdict = landed ? "done" : classifyWriteFailure(failure, write.method);
    if (verdict === "done") {
      const whole = landings.get(write.kind)?.(queryClient, write, landed?.data) ?? true;
      settle(write, whole ? "flushed" : "rejected");
      continue;
    }
    if (verdict === "reject") {
      settle(write, "rejected");
      continue;
    }

    const failedAt = Date.now();
    // Only a span of answered failures counts toward giving up. A network
    // failure restarts the clock: a 502, three days without signal and one
    // more 503 are not a day of the server refusing this write.
    const answered = statusOf(failure) !== null;
    const failingSince = answered ? (write.failingSince ?? failedAt) : null;
    if (failingSince !== null && failedAt - failingSince >= GIVE_UP_AFTER_MS) {
      settle(write, "rejected");
      continue;
    }
    store().deferWrite(write.id, {
      nextAttemptAt: failedAt + retryDelayMs(write.attempts + 1),
      failingSince,
    });
    if (!answered) break;
    hold(write);
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
