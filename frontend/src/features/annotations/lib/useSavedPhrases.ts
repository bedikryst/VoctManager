/**
 * @file useSavedPhrases.ts
 * @description The phrases a writer keeps on this device, across every piece:
 * a word the stamp catalogue lacks is typed once and is one tap in every score
 * after (`rememberPhrase` decides what is kept and in what order).
 *
 * Kept per signed-in user, never per device alone: a short note on the
 * conductor's layer can name a singer, and must not surface in the chip row of
 * the next account on a shared tablet. Held in memory and read through
 * `useSyncExternalStore`, because the songbook keeps a stand mounted for every
 * piece and a word kept in one must be in the next one opened; copied to
 * storage for the next visit.
 * @module features/annotations/lib
 */

import { useCallback, useSyncExternalStore } from "react";

import { readStored, writeStored } from "./deviceStorage";
import { MAX_SAVED_PHRASES, rememberPhrase, type Phrase } from "./quickPhrases";

const STORAGE_PREFIX = "voct.annotations.phrases.";
const NONE: readonly Phrase[] = [];

const kept = new Map<string, readonly Phrase[]>();
const listeners = new Set<() => void>();

const isPhrase = (value: unknown): value is Phrase => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.text === "string" && typeof entry.italic === "boolean";
};

/** Whatever storage holds is read defensively: an older shape or a hand edit reads as nothing. */
const parse = (raw: string | null): readonly Phrase[] => {
  if (!raw) return NONE;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isPhrase).slice(0, MAX_SAVED_PHRASES) : NONE;
  } catch {
    return NONE;
  }
};

const read = (userId: string): readonly Phrase[] => {
  let list = kept.get(userId);
  if (list === undefined) {
    list = parse(readStored(`${STORAGE_PREFIX}${userId}`));
    kept.set(userId, list);
  }
  return list;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The signed-in writer's kept phrases, and the way to keep one. With nobody
 * signed in there is nothing to keep and nothing is shown.
 */
export const useSavedPhrases = (
  userId: string | null,
): [readonly Phrase[], (phrase: Phrase, presets: readonly string[]) => void] => {
  const snapshot = useCallback(() => (userId ? read(userId) : NONE), [userId]);
  const phrases = useSyncExternalStore(subscribe, snapshot);

  const remember = useCallback(
    (phrase: Phrase, presets: readonly string[]) => {
      if (!userId) return;
      const next = rememberPhrase(read(userId), phrase, presets);
      kept.set(userId, next);
      writeStored(`${STORAGE_PREFIX}${userId}`, JSON.stringify(next));
      for (const listener of listeners) listener();
    },
    [userId],
  );

  return [phrases, remember];
};
