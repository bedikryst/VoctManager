/**
 * @file installController.ts
 * @description App-boot controller for the PWA install prompt. Chromium fires
 * `beforeinstallprompt` exactly once, and often *early* — frequently before the
 * authenticated shell (and therefore any component effect) has mounted.
 * Capturing it inside a component is a race that is regularly lost, which is
 * why "the install button sometimes never appears". This module attaches the
 * listeners at import time (i.e. at app boot, well ahead of the shell) and also
 * drains the even-earlier buffer captured by the inline snippet in `index.html`,
 * then exposes the result through a `useSyncExternalStore`-compatible snapshot.
 * The deferred event is consumed exactly once per the browser contract.
 * @module shared/pwa/installController
 */

/** Chromium-only event; not yet in the DOM lib typings. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  /**
   * Pre-bundle buffer written by the inline snippet in `index.html` — the
   * earliest possible capture, before this module (or React) has evaluated.
   */
  interface Window {
    __voctInstall?: {
      event: BeforeInstallPromptEvent | null;
      installed: boolean;
    };
  }
}

export interface InstallSnapshot {
  /** Chromium handed us a usable prompt → a one-tap install is possible. */
  readonly canPrompt: boolean;
  /** Already running as / known to be an installed app. */
  readonly isInstalled: boolean;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

const detectStandalone = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

// The deferred event is held OUTSIDE the snapshot on purpose: it is a single-use,
// mutable browser object (calling `.prompt()` consumes it) and must never be
// compared by `Object.is`. The snapshot exposes only its *presence* (`canPrompt`).
let deferredEvent: BeforeInstallPromptEvent | null = null;

let snapshot: InstallSnapshot = {
  canPrompt: false,
  isInstalled: detectStandalone(),
};

const listeners = new Set<() => void>();

const setSnapshot = (next: InstallSnapshot): void => {
  if (
    next.canPrompt === snapshot.canPrompt &&
    next.isInstalled === snapshot.isInstalled
  ) {
    return; // no observable change — keep the reference stable for the store
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const captureEvent = (event: BeforeInstallPromptEvent): void => {
  deferredEvent = event;
  setSnapshot({ canPrompt: true, isInstalled: snapshot.isInstalled });
};

const markInstalled = (): void => {
  deferredEvent = null;
  setSnapshot({ canPrompt: false, isInstalled: true });
};

let initialized = false;
const initialize = (): void => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // 1) Drain the inline buffer — the only path that can catch an event fired
  //    before this module evaluated (the genuine boot race the old hook lost).
  const buffered = window.__voctInstall;
  if (buffered?.installed) markInstalled();
  if (buffered?.event) captureEvent(buffered.event);

  // 2) Own every subsequent event directly. (The inline snippet keeps its own
  //    listeners too; a second `preventDefault` is idempotent and harmless.)
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // suppress the mini-infobar; we drive first-party UI
    captureEvent(event);
  });
  window.addEventListener("appinstalled", markInstalled);

  // Installed mid-session without a reload → display-mode flips to standalone.
  const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
  standaloneQuery?.addEventListener("change", (event) => {
    if (event.matches) markInstalled();
  });
};

initialize();

export const subscribeInstall = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getInstallSnapshot = (): InstallSnapshot => snapshot;

/**
 * Fire the native install prompt. Resolves with the user's choice, or
 * `"unavailable"` when no prompt was captured (non-Chromium, already installed,
 * or a previously consumed event). The event is single-use per browser contract,
 * so it is cleared on completion.
 */
export const triggerInstallPrompt = async (): Promise<InstallOutcome> => {
  const event = deferredEvent;
  if (!event) return "unavailable";

  await event.prompt();
  const { outcome } = await event.userChoice;

  deferredEvent = null;
  setSnapshot({ canPrompt: false, isInstalled: snapshot.isInstalled });
  return outcome;
};
