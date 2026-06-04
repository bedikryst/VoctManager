/**
 * @file useAppStore.ts
 * @description Global application state managed by Zustand.
 * Handles the page loading sequence, allowing various components
 * (Preloader, Hero, Lenis Scroll) to react synchronously.
 * @architecture Enterprise 2026 Standards
 * @module store/useAppStore
 */

import { create } from "zustand";

export interface AppState {
  isSidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;

  isLoaded: boolean;
  setIsLoaded: (status: boolean) => void;

  // Gates the EtherealBackground's one-time intro draw-in. Set true once the
  // stave/clef animation has played; persists for the session (cleared on full
  // reload), so subsequent route changes skip straight to the settled state.
  isAuraStabilized: boolean;
  stabilizeAura: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoaded: false,
  setIsLoaded: (status: boolean) => set({ isLoaded: status }),

  isSidebarExpanded: false,
  setSidebarExpanded: (expanded: boolean) =>
    set({ isSidebarExpanded: expanded }),

  isAuraStabilized: false,
  stabilizeAura: () => set({ isAuraStabilized: true }),
}));
