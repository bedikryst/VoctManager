/**
 * @file useFeedbackStore.ts
 * @description Open/closed state of the in-app feedback sheet, plus the prefill
 * a caller can hand it.
 *
 * It lives in the global store rather than inside the widget because the most
 * valuable place to offer "report this" is a surface that has just failed — the
 * panel error boundary — and that boundary is a class component sitting above
 * the widget in the tree. A module-level store lets it ask for the sheet without
 * either side importing the other.
 * @architecture Enterprise SaaS 2026
 * @module store/useFeedbackStore
 */

import { create } from "zustand";

export interface FeedbackPrefill {
  /** Seeds the body so a crash report costs the member one tap, not a paragraph. */
  body?: string;
  /** Technical detail carried alongside the body, never shown in the textarea. */
  technicalDetail?: string;
}

interface FeedbackState {
  isOpen: boolean;
  prefill: FeedbackPrefill | null;
  openFeedback: (prefill?: FeedbackPrefill) => void;
  closeFeedback: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  isOpen: false,
  prefill: null,

  openFeedback: (prefill) => set({ isOpen: true, prefill: prefill ?? null }),

  // The prefill is dropped on close so the next unprompted report does not open
  // pre-filled with the last crash the member happened to hit.
  closeFeedback: () => set({ isOpen: false, prefill: null }),
}));
