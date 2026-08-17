/**
 * @file usePieceDirty.ts
 * @description Registry of unsaved edits held by the Piece Card's row editors
 * (movements, translations, program notes). Those rows own their own draft
 * buffers and their own save mutations, so nothing in the page's form state can
 * see them — which is how "Zatwierdź i opublikuj" could publish a record while a
 * corrected translation still sat unsent in its textarea. Each row reports its
 * dirty flag here; the page reads the set to gate publication, and each section
 * reads its own slice to mark where the unsaved work is.
 *
 * The context value is the registrar alone (a stable callback), never the set —
 * so a keystroke in one row re-renders the page that owns the state, not every
 * other row subscribing to it.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/hooks/usePieceDirty
 */

import { createContext, useContext, useEffect } from "react";

export type RegisterDirty = (key: string, dirty: boolean) => void;

const PieceDirtyContext = createContext<RegisterDirty>(() => {});

export const PieceDirtyProvider = PieceDirtyContext.Provider;

/** Keys are `<kind>:<id>` so a section can count its own backlog and nothing else. */
export const dirtyKey = (kind: string, id: string): string => `${kind}:${id}`;

/**
 * Row-editor side of the registry. Clearing on unmount is not tidiness: a row
 * deleted while dirty would otherwise leave a key nobody can ever satisfy, and
 * the publish button would stay disabled with no visible cause.
 */
export const useRegisterDirty = (key: string, dirty: boolean): void => {
  const register = useContext(PieceDirtyContext);
  useEffect(() => {
    register(key, dirty);
    return () => register(key, false);
  }, [key, dirty, register]);
};

/** How many unsaved rows of one kind the registry currently holds. */
export const countDirty = (keys: ReadonlySet<string>, kind: string): number => {
  const prefix = `${kind}:`;
  let count = 0;
  for (const key of keys) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
};
