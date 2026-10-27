/**
 * @file deviceStorage.ts
 * @description The one way the annotation tools remember something about this
 * device between scores: which tool was in hand, whether the finger draws,
 * whether a stylus has ever touched the screen, the toolbar left open, which
 * layers are shown.
 *
 * None of it is server state, and none of it may break the score: private mode,
 * disabled storage or a full quota make a read come back empty and a write do
 * nothing, and the choice still holds for the session.
 * @module features/annotations/lib
 */

export const readStored = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStored = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice still holds for the session.
  }
};
