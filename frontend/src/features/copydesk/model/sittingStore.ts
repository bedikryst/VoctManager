/**
 * @file sittingStore.ts
 * @description What this visit to the desk has written, whether the reviewers
 * have been told about it yet, and which languages it is reading in.
 *
 * It exists because the two halves of that question sit in different places in
 * the tree: the cell that autosaves is deep inside a page, and the control that
 * says "I have finished" belongs to the desk's rail, where it is on screen
 * whatever page the editor is on. A module-level store lets the rail know work
 * has happened without either side importing the other, the same reason
 * `useFeedbackStore` is one.
 *
 * The counter is deliberately session-shaped and deliberately shallow: it is
 * not a record of anything. Every proposal is already on the server the moment
 * it is typed, the digest goes out on the clock regardless, and reloading the
 * page loses nothing but the offer of an early one.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/model/sittingStore
 */

import { create } from "zustand";

import type { LocaleViewId } from "../lib/localeView";

interface CopyDeskSittingState {
  /** Proposals written or revised since the desk was opened. */
  edits: number;
  /** What `edits` stood at when a digest was last raised by hand. */
  announced: number;
  /**
   * Which languages the editor is reading in. It belongs to the sitting rather
   * than to the page: somebody working through six concerts against the French
   * has chosen a way of reading the desk, not a setting for one concert, and
   * re-picking it on every page is the kind of friction that ends in a
   * spreadsheet.
   */
  localeView: LocaleViewId;
  noteEdit: () => void;
  noteAnnounced: () => void;
  setLocaleView: (view: LocaleViewId) => void;
  resetSitting: () => void;
}

export const useCopyDeskSitting = create<CopyDeskSittingState>((set) => ({
  edits: 0,
  announced: 0,
  localeView: "pl",

  setLocaleView: (localeView) => set({ localeView }),

  noteEdit: () => set((state) => ({ edits: state.edits + 1 })),

  // Not a flag: an editor who carries on writing after telling the reviewers is
  // in the same position they were in before — with work nobody has been told
  // about — so the offer has to come back rather than being spent once.
  noteAnnounced: () => set((state) => ({ announced: state.edits })),

  resetSitting: () => set({ edits: 0, announced: 0, localeView: "pl" }),
}));

/** Work has been written that no digest has carried yet. */
export const hasUnannouncedWork = (state: {
  edits: number;
  announced: number;
}): boolean => state.edits > state.announced;
