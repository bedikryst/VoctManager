/**
 * @file useInstallPrompt.ts
 * @description React binding over the app-boot install controller. The
 * controller — not this hook — captures `beforeinstallprompt`, so the prompt is
 * never lost to the mount race ({@link module:shared/pwa/installController}).
 * This hook just projects the live snapshot and layers the UI concerns: iOS
 * Add-to-Home-Screen detection (no event exists there) and the dismissible
 * 14-day cooldown that gates the *ambient nudge* card. The deliberate Settings
 * entry point ignores the cooldown and reads the capabilities directly.
 * @module shared/pwa/useInstallPrompt
 */
import { useCallback, useState, useSyncExternalStore } from "react";

import {
  getInstallSnapshot,
  subscribeInstall,
  triggerInstallPrompt,
  type InstallOutcome,
} from "./installController";

const DISMISS_KEY = "voct.pwa.install.dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // re-offer the nudge after two weeks

export type InstallPlatform = "chromium" | "ios" | "none";

export interface InstallPromptState {
  /** A first-party install button can be shown (Chromium captured the event). */
  canPrompt: boolean;
  /** iOS Safari — show manual Add-to-Home-Screen instructions instead. */
  isIOS: boolean;
  /** Already running as an installed app. */
  isInstalled: boolean;
  /** The ambient nudge should be surfaced (not installed, not dismissed). */
  shouldOffer: boolean;
  platform: InstallPlatform;
  /** Trigger the native prompt; resolves with the user's choice. */
  promptInstall: () => Promise<InstallOutcome>;
  /** Snooze the ambient nudge for the cooldown window. */
  dismiss: () => void;
}

const detectIOS = (): boolean =>
  typeof navigator !== "undefined" &&
  /ipad|iphone|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent); // only Safari can A2HS

const recentlyDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? Date.now() - Number(raw) < DISMISS_COOLDOWN_MS : false;
  } catch {
    return false;
  }
};

export const useInstallPrompt = (): InstallPromptState => {
  const { canPrompt, isInstalled } = useSyncExternalStore(
    subscribeInstall,
    getInstallSnapshot,
    getInstallSnapshot, // server snapshot — identical, this is a CSR-only app
  );
  const [dismissed, setDismissed] = useState<boolean>(recentlyDismissed);
  const isIOS = detectIOS();

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // best-effort — a failed write just means we re-offer next session
    }
    setDismissed(true);
  }, []);

  const promptInstall = useCallback(() => triggerInstallPrompt(), []);

  const platform: InstallPlatform = canPrompt
    ? "chromium"
    : isIOS
      ? "ios"
      : "none";
  const shouldOffer = !isInstalled && !dismissed && (canPrompt || isIOS);

  return {
    canPrompt,
    isIOS,
    isInstalled,
    shouldOffer,
    platform,
    promptInstall,
    dismiss,
  };
};
