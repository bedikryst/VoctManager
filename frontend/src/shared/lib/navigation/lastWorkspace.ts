/**
 * @file lastWorkspace.ts
 * @description Device-local memory of the panel surface a person last used.
 * Storage may be unavailable in a private or locked-down browser, so reads and
 * writes are best-effort and never interrupt navigation.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/navigation/lastWorkspace
 */

export type LastWorkspace = "finance" | "panel";

const STORAGE_KEY = "voct:last-workspace";

export const rememberWorkspace = (workspace: LastWorkspace): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, workspace);
  } catch {
    // Storage is optional: the login fallback simply remains the panel.
  }
};

export const readLastWorkspace = (): LastWorkspace | null => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "finance" || value === "panel" ? value : null;
  } catch {
    return null;
  }
};
