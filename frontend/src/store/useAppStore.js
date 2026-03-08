/**
 * @file useAppStore.js
 * @description Global application state managed by Zustand.
 * Handles the page loading sequence, allowing various components 
 * (Preloader, Hero, Lenis Scroll) to react synchronously.
 * @author Krystian Bugalski
 */

import { create } from 'zustand';

export const useAppStore = create((set) => ({
  isLoaded: false,
  setIsLoaded: (status) => set({ isLoaded: status }),
}));