/**
 * @file useAppStore.ts
 * @description Global application state managed by Zustand.
 * Handles the page loading sequence, allowing various components
 * (Preloader, Hero, Lenis Scroll) to react synchronously.
 * @architecture Enterprise 2026 Standards
 * @module store/useAppStore
 */

import { create } from "zustand";

interface AppState {
  isLoaded: boolean;
  setIsLoaded: (status: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoaded: false,
  setIsLoaded: (status: boolean) => set({ isLoaded: status }),
}));
