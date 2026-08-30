/**
 * @file useTheme.ts
 * @description React binding over the app-boot theme store. The controller —
 * not this hook — owns the `data-theme` attribute and the OS listener
 * ({@link module:shared/theme/themeController}), so the theme is applied whether
 * or not any component is mounted. This hook only projects the live snapshot
 * and hands back the setter, for the two consumers that need to READ the theme
 * in React: the settings control and any third-party surface that paints its
 * own skin (the toast portal).
 * @architecture Enterprise SaaS 2026
 * @module shared/theme/useTheme
 */
import { useSyncExternalStore } from "react";

import {
  getThemeSnapshot,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
  type ThemeSnapshot,
} from "./themeController";

export interface ThemeState extends ThemeSnapshot {
  setPreference: (preference: ThemePreference) => void;
}

export const useTheme = (): ThemeState => {
  const { preference, resolved } = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeSnapshot, // server snapshot — identical, this is a CSR-only app
  );

  // `setThemePreference` is a module-level function, already referentially
  // stable — no `useCallback` wrapper earns its keep here.
  return { preference, resolved, setPreference: setThemePreference };
};
