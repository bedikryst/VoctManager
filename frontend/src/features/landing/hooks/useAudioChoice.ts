/**
 * @file useAudioChoice.ts
 * @description Persists the user's threshold gate decision (silence | voice) with a 3h TTL.
 * Legacy raw-string format from the static HTML is auto-migrated on read.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useAudioChoice
 */

import { useCallback } from "react";

export type AudioChoice = "silence" | "voice";

const STORAGE_KEY = "voct.demo.audio";
const TTL_MS = 3 * 60 * 60 * 1000;

interface StoredChoice {
  readonly choice: AudioChoice;
  readonly timestamp: number;
}

function readChoice(): AudioChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    if (raw === "silence" || raw === "voice") return raw;
    const data = JSON.parse(raw) as Partial<StoredChoice>;
    if (data?.choice !== "silence" && data?.choice !== "voice") return null;
    if (!Number.isFinite(data?.timestamp)) return null;
    if (Date.now() - (data.timestamp as number) > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data.choice;
  } catch {
    return null;
  }
}

function writeChoice(choice: AudioChoice): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ choice, timestamp: Date.now() } satisfies StoredChoice),
    );
  } catch {
    /* localStorage may be unavailable in private mode — silent fail is correct */
  }
}

export function useAudioChoice(): {
  readonly read: () => AudioChoice | null;
  readonly write: (choice: AudioChoice) => void;
} {
  const read = useCallback(readChoice, []);
  const write = useCallback(writeChoice, []);
  return { read, write };
}
