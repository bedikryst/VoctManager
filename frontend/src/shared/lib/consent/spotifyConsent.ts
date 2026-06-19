/**
 * @file spotifyConsent.ts
 * @description Single source of truth for the user's RODO/GDPR consent to load
 * the third-party Spotify embed (a "click-to-load" / two-click gate). The embed
 * sets Spotify cookies and phones home, so nothing is loaded until consent is
 * granted. Consent is remembered in localStorage and — per RODO art. 7 ust. 3
 * (withdrawal must be as easy as granting) — revocable from Settings → Privacy.
 *
 * Exposes a `useSyncExternalStore`-backed hook so the player widget and the
 * settings toggle stay in sync live, same-tab and across tabs.
 * @module shared/lib/consent/spotifyConsent
 */

import { useSyncExternalStore } from "react";

export const SPOTIFY_CONSENT_KEY = "voct:spotify-embed-consent";

const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

export const readSpotifyConsent = (): boolean => {
  try {
    return localStorage.getItem(SPOTIFY_CONSENT_KEY) === "1";
  } catch {
    // Private mode / disabled storage — treat as no consent.
    return false;
  }
};

/** Grants or withdraws consent and notifies every subscribed surface. */
export const setSpotifyConsent = (granted: boolean): void => {
  try {
    if (granted) {
      localStorage.setItem(SPOTIFY_CONSENT_KEY, "1");
    } else {
      localStorage.removeItem(SPOTIFY_CONSENT_KEY);
    }
  } catch {
    // Storage unavailable — consent then holds for this session only.
  }
  emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // Cross-tab: another tab granting/revoking fires a storage event.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === SPOTIFY_CONSENT_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** Reactive consent flag — re-renders on grant/withdraw from anywhere. */
export const useSpotifyConsent = (): boolean =>
  useSyncExternalStore(subscribe, readSpotifyConsent, () => false);
