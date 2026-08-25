/**
 * @file appUpdateController.ts
 * @description App-boot controller for build handovers. A deploy replaces every
 * content-hashed file on the server, so a tab left open across one is running a
 * bundle whose remaining lazy chunks exist nowhere except the precache it booted
 * with — which is why `sw.ts` no longer lets a new build seize an open tab. That
 * leaves two jobs for this side of the line: notice that a newer build is parked
 * in `waiting`, and perform the swap deterministically when the member asks for
 * it (or when a failed chunk forces the issue).
 *
 * "Deterministically" is the whole point. A bare `location.reload()` re-enters
 * the navigation route the OLD worker still controls and is answered from the
 * OLD precache — the same shell, the same crash, which is exactly what the
 * "Odśwież" button used to do. The swap here releases the waiting worker first
 * and only reloads once it has actually taken control.
 *
 * Attached at import time (like {@link module:shared/pwa/installController}) and
 * exposed through a `useSyncExternalStore`-compatible snapshot.
 * @architecture Enterprise SaaS 2026
 * @module shared/pwa/appUpdateController
 */

import type { SkipWaitingRequest } from "@/shared/offline/swProtocol";

export interface AppUpdateSnapshot {
  /** A newer build is installed and parked behind the one this tab is running. */
  readonly isReady: boolean;
  /** A handover is in flight; the tab is about to reload onto the new build. */
  readonly isApplying: boolean;
}

/**
 * The build this tab handed control away from, kept for the length of the tab's
 * session. Compared against `__APP_BUILD__` after the reload: an unchanged stamp
 * means the handover produced the same bundle it started from, so re-offering it
 * would put the member in a refresh loop the app cannot win.
 */
const HANDOFF_KEY = "voct.pwa.build-handoff";
/** How long an unproductive handover suppresses the offer (a later, real deploy still gets through). */
const HANDOFF_SUPPRESS_MS = 10 * 60 * 1000;

/** Background re-checks: often enough to catch a deploy mid-session, rarely enough to be free. */
const UPDATE_POLL_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_CHECK_THROTTLE_MS = 5 * 60 * 1000;
/** A slow install must not wedge the button — reload anyway and let the worker finish behind us. */
const INSTALL_WAIT_TIMEOUT_MS = 15_000;
/** `controllerchange` is the proof the swap landed; without it we reload regardless. */
const CONTROLLER_HANDOFF_TIMEOUT_MS = 5_000;

let snapshot: AppUpdateSnapshot = { isReady: false, isApplying: false };

const listeners = new Set<() => void>();

const setSnapshot = (next: AppUpdateSnapshot): void => {
  if (next.isReady === snapshot.isReady && next.isApplying === snapshot.isApplying) {
    return; // no observable change — keep the reference stable for the store
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
};

interface HandoffRecord {
  build: string;
  at: number;
}

const readHandoff = (): HandoffRecord | null => {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HandoffRecord>;
    if (typeof parsed.build !== "string" || typeof parsed.at !== "number") return null;
    return { build: parsed.build, at: parsed.at };
  } catch {
    return null;
  }
};

const rememberHandoff = (): void => {
  try {
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ build: __APP_BUILD__, at: Date.now() } satisfies HandoffRecord),
    );
  } catch {
    // Private-mode storage refusal only costs us the loop guard, never the swap.
  }
};

/** True while a recent handover demonstrably failed to move this tab off its build. */
const handoffStalled = (): boolean => {
  const record = readHandoff();
  if (!record) return false;
  return (
    record.build === __APP_BUILD__ && Date.now() - record.at < HANDOFF_SUPPRESS_MS
  );
};

/** The stamp moved — the previous handover worked, so stop carrying its record. */
const forgetSettledHandoff = (): void => {
  const record = readHandoff();
  if (!record || record.build === __APP_BUILD__) return;
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* best-effort */
  }
};

const markReady = (): void => {
  if (handoffStalled()) return;
  setSnapshot({ isReady: true, isApplying: snapshot.isApplying });
};

const isSupported = (): boolean =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator;

const currentRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
  } catch {
    return null;
  }
};

// ── watching ─────────────────────────────────────────────────────────────────

let watched: ServiceWorkerRegistration | null = null;
let lastCheckedAt = 0;

const checkForUpdate = (registration: ServiceWorkerRegistration): void => {
  const now = Date.now();
  if (now - lastCheckedAt < UPDATE_CHECK_THROTTLE_MS) return;
  lastCheckedAt = now;
  void registration.update().catch(() => {
    // Offline, or the server did not answer — the next trigger tries again.
  });
};

/**
 * Starts watching a registration for a newer build. Called once, from the same
 * place that registers the worker, so the offer is armed for every member rather
 * than only for the ones who opened a surface that happens to mount a hook.
 *
 * The `controller` checks are what separate "a newer build is waiting" from "the
 * very first install on this device": with no controller there is no older
 * bundle to be stranded on, and announcing an update to somebody who has just
 * arrived would be nonsense.
 */
export const armAppUpdateWatch = (registration: ServiceWorkerRegistration): void => {
  if (!isSupported() || watched === registration) return;
  watched = registration;

  forgetSettledHandoff();

  if (registration.waiting && navigator.serviceWorker.controller) markReady();

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        markReady();
      }
    });
  });

  // The FIRST worker to control this page also fires `controllerchange` (via
  // `clients.claim()`), and that is an installation, not a build swap — without
  // this latch every first-ever visit would be greeted by an update offer.
  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const wasControlled = hadController;
    hadController = true;
    if (!wasControlled) return;

    // Not us: another tab released the waiting worker, so the precache this
    // tab's chunks resolve from has just been replaced under it. Nothing is
    // broken *yet* — the next lazy route would be — so say so while it is still
    // a choice rather than a crash.
    if (!snapshot.isApplying) markReady();
  });

  const check = (): void => checkForUpdate(registration);

  // Coming back to the app is the moment a deploy is most likely to have landed
  // unnoticed, and the moment the answer is cheapest to act on.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("online", check);

  // Only in production: the dev worker is rebuilt on every restart of the dev
  // server, and a poll there would offer an "update" every half hour forever.
  if (import.meta.env.PROD) {
    window.setInterval(check, UPDATE_POLL_INTERVAL_MS);
  }
};

// ── applying ─────────────────────────────────────────────────────────────────

const nextControllerChange = (): Promise<void> =>
  new Promise<void>((resolve) => {
    if (!isSupported()) {
      resolve();
      return;
    }
    const settle = (): void => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", settle);
      resolve();
    };
    const timer = window.setTimeout(settle, CONTROLLER_HANDOFF_TIMEOUT_MS);
    navigator.serviceWorker.addEventListener("controllerchange", settle);
  });

/**
 * The worker parked in `waiting`, letting an install that is still running
 * finish first. `registration.update()` normally resolves only once the new
 * worker is installed, but reloading a beat too early is precisely the race that
 * lands the member back on the old shell — so this waits explicitly, and gives
 * up after a bounded delay rather than holding the button hostage.
 */
const waitingWorker = async (
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorker | null> => {
  if (registration.waiting) return registration.waiting;

  const installing = registration.installing;
  if (!installing) return null;

  await new Promise<void>((resolve) => {
    const settle = (): void => {
      window.clearTimeout(timer);
      installing.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = (): void => {
      if (installing.state !== "installing") settle();
    };
    const timer = window.setTimeout(settle, INSTALL_WAIT_TIMEOUT_MS);
    installing.addEventListener("statechange", onStateChange);
  });

  return registration.waiting;
};

/**
 * Moves this tab onto the newest build available, once. Asks the server whether
 * a newer worker exists (the crash path usually arrives before this tab has
 * noticed the deploy at all), releases it, waits for it to take control, and
 * only then reloads — so the navigation is answered by the new precache instead
 * of the one that just failed.
 *
 * Reloads even when there is no update to find: for a genuine, one-off render
 * fault a clean boot is still the right recovery, and it is what the fault
 * surface's button promises.
 */
export const applyAppUpdate = async (): Promise<void> => {
  if (snapshot.isApplying) return;
  setSnapshot({ isReady: snapshot.isReady, isApplying: true });
  rememberHandoff();

  const registration = await currentRegistration();

  if (registration) {
    try {
      await registration.update();
    } catch {
      // A failed check is not a reason to strand the member on a broken view.
    }

    const waiting = await waitingWorker(registration);
    if (waiting) {
      // Listen BEFORE asking: the worker can activate within the same task, and
      // a listener attached afterwards would wait out the whole timeout.
      const handedOver = nextControllerChange();
      waiting.postMessage({ type: "VOCT_SKIP_WAITING" } satisfies SkipWaitingRequest);
      await handedOver;
    }
  }

  window.location.reload();
};

/**
 * Fire-and-forget form for callers that can only hand over a `() => void` — the
 * class error boundaries. Failures inside end at the reload either way.
 */
export const reloadOntoLatestBuild = (): void => {
  void applyAppUpdate();
};

export const subscribeAppUpdate = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getAppUpdateSnapshot = (): AppUpdateSnapshot => snapshot;
