/**
 * @file useInstallPrompt.ts
 * @description Drives the "install this app" affordance. Captures Chromium's
 * `beforeinstallprompt` so we can offer a first-party install button, detects
 * the iOS case (no such event — manual Add to Home Screen), and stays quiet
 * once installed or recently dismissed.
 * @module shared/pwa/useInstallPrompt
 */
import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const DISMISS_KEY = "voct.pwa.install.dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // re-offer after two weeks

export type InstallPlatform = "chromium" | "ios" | "none";

export interface InstallPromptState {
  /** A first-party install button can be shown (Chromium captured the event). */
  canPrompt: boolean;
  /** iOS Safari — show manual Add-to-Home-Screen instructions instead. */
  isIOS: boolean;
  /** Already running as an installed app — never offer install. */
  isStandalone: boolean;
  /** The prompt should currently be surfaced (not standalone, not dismissed). */
  shouldOffer: boolean;
  platform: InstallPlatform;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

const detectStandalone = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const detectIOS = (): boolean =>
  typeof navigator !== "undefined" &&
  /ipad|iphone|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent); // only Safari can A2HS

const recentlyDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
};

export const useInstallPrompt = (): InstallPromptState => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone);
  const [dismissed, setDismissed] = useState<boolean>(recentlyDismissed);
  const isIOS = detectIOS();

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // suppress the mini-infobar; we drive our own UI
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // best-effort — a failed write just means we re-offer next session
    }
    setDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "dismissed") dismiss();
  }, [deferred, dismiss]);

  const canPrompt = !!deferred;
  const platform: InstallPlatform = canPrompt ? "chromium" : isIOS ? "ios" : "none";
  const shouldOffer =
    !isStandalone && !dismissed && (canPrompt || isIOS);

  return {
    canPrompt,
    isIOS,
    isStandalone,
    shouldOffer,
    platform,
    promptInstall,
    dismiss,
  };
};
