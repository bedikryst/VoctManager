/**
 * @file vocalRangeSession.ts
 * @description What the vocal-range screen remembers between openings, for as
 * long as the page lives and never in storage, since stored state would outlive
 * the session it belongs to:
 *  - the snooze: "Later" keeps the prompt away for a bounded time, not for the
 *    page's life, because an installed iOS app can stay in memory for days and
 *    a desktop tab indefinitely. It is rechecked whenever the page comes back
 *    into view, which is when a snoozed prompt is due again;
 *  - the unsent draft: closing the screen, by "Later", Escape or "Close",
 *    keeps the chosen notes and comment, and the next opening restores them.
 * @module features/vocal-range/lib/vocalRangeSession
 */

import { useSyncExternalStore } from "react";

import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";

/** Long enough that "Later" is not asked again the same day. */
const SNOOZE_MS = 12 * 60 * 60 * 1000;

let snoozed = false;
let snoozedUntil = 0;
let expiryTimer: number | undefined;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const expireIfDue = (): void => {
  if (!snoozed || Date.now() < snoozedUntil) return;
  snoozed = false;
  emit();
};

// A timer in a hidden page is throttled or frozen, so it may fire late; the
// return to view catches what it missed.
const onVisibilityChange = (): void => {
  if (document.visibilityState === "visible") expireIfDue();
};

const subscribe = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
};

const readSnoozed = (): boolean => snoozed;

export const snoozeVocalRangePrompt = (): void => {
  snoozedUntil = Date.now() + SNOOZE_MS;
  window.clearTimeout(expiryTimer);
  expiryTimer = window.setTimeout(expireIfDue, SNOOZE_MS);
  if (snoozed) return;
  snoozed = true;
  emit();
};

export const useVocalRangePromptSnoozed = (): boolean =>
  useSyncExternalStore(subscribe, readSnoozed, readSnoozed);

export interface VocalRangeDraft {
  readonly draft: VocalRangeMidi;
  readonly comment: string;
}

let keptDraft: VocalRangeDraft | null = null;

/** Keep what the screen held when it closed unsent. */
export const keepVocalRangeDraft = (value: VocalRangeDraft): void => {
  keptDraft = value;
};

/** The draft kept at the last close, or null. It stays kept until replaced or
 *  sent, so closing again without a change keeps it still. */
export const readVocalRangeDraft = (): VocalRangeDraft | null => keptDraft;

/** Sent: what the server holds is the draft now. */
export const clearVocalRangeDraft = (): void => {
  keptDraft = null;
};
