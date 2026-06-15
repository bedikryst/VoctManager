/**
 * @file quickAccessStore.ts
 * @description Tiny external store (useSyncExternalStore) for the command
 * palette's project quick-access: auto-tracked **recents** + user-pinned
 * **favorites**. Lives outside React so the provider (which records visits as
 * the conductor navigates) and the palette (which reads them) stay in sync
 * within the tab without prop drilling. Persisted to localStorage; stale ids
 * (deleted projects) are tolerated — the palette resolves ids against the live
 * project list and silently drops misses.
 * @module widgets/panel-shell/command
 * @architecture Enterprise SaaS 2026
 */

import { useSyncExternalStore } from "react";

const FAVORITES_KEY = "voct.cmd.favProjects";
const RECENTS_KEY = "voct.cmd.recentProjects";
const RECENTS_CAP = 8;

export interface QuickAccessState {
  readonly favorites: readonly string[];
  readonly recents: readonly string[];
}

const readIds = (key: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const persist = (key: string, ids: readonly string[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode / quota — keep the in-memory value for the session.
  }
};

let state: QuickAccessState = {
  favorites: readIds(FAVORITES_KEY),
  recents: readIds(RECENTS_KEY),
};

const listeners = new Set<() => void>();
const emit = (): void => {
  for (const listener of listeners) listener();
};

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const recordProjectVisit = (id: string): void => {
  if (!id) return;
  const recents = [id, ...state.recents.filter((value) => value !== id)].slice(
    0,
    RECENTS_CAP,
  );
  if (sameOrder(recents, state.recents)) return;
  state = { ...state, recents };
  persist(RECENTS_KEY, recents);
  emit();
};

export const toggleProjectFavorite = (id: string): void => {
  if (!id) return;
  const favorites = state.favorites.includes(id)
    ? state.favorites.filter((value) => value !== id)
    : [id, ...state.favorites];
  state = { ...state, favorites };
  persist(FAVORITES_KEY, favorites);
  emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): QuickAccessState => state;

export const useProjectQuickAccess = (): QuickAccessState =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
