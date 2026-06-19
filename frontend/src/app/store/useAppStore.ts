/**
 * @file useAppStore.ts
 * @description Global panel-shell UI state managed by Zustand: sidebar
 * expansion and the one-time background intro gate.
 * @architecture Enterprise 2026 Standards
 * @module store/useAppStore
 */

import { create } from "zustand";

export interface AppState {
  isSidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;

  // Gates the EtherealBackground's one-time intro draw-in. Set true once the
  // stave/clef animation has played; persists for the session (cleared on full
  // reload), so subsequent route changes skip straight to the settled state.
  isAuraStabilized: boolean;
  stabilizeAura: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarExpanded: false,
  setSidebarExpanded: (expanded: boolean) =>
    set({ isSidebarExpanded: expanded }),

  isAuraStabilized: false,
  stabilizeAura: () => set({ isAuraStabilized: true }),
}));
