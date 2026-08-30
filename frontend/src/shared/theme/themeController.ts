/**
 * @file themeController.ts
 * @description App-boot store for the light/dark preference — the single owner
 * of the `data-theme` attribute on <html> and of the live `theme-color` meta.
 *
 * The preference is device-local (`localStorage`), deliberately NOT on the
 * account. `language` lives on the profile because the SERVER consumes it —
 * every push, e-mail and digest renders in it — and no server-side artefact of
 * VoctManager has a theme. An account-wide theme would also be wrong in the one
 * case that actually happens: dark on the phone held in a dim rehearsal room,
 * light on the laptop at a desk.
 *
 * The FIRST stamp is not made here. It is made during parse by the inline
 * snippet in `index.html`, because the bundle is lazy and by the time this
 * module evaluates the light ground has already painted. The two must stay in
 * lockstep: same key, same media query, same resolution rule. This module's own
 * jobs are to write the preference, re-stamp the attribute, and keep a
 * `matchMedia` listener alive so an OS that flips while the app is open — an
 * Android auto-dark schedule at dusk, mid-rehearsal — is followed.
 * @architecture Enterprise SaaS 2026
 * @module shared/theme/themeController
 */

/** What the member chose. `system` defers to the OS, and keeps deferring. */
export type ThemePreference = "system" | "light" | "dark";

/** What is actually painted. `system` has already been resolved away. */
export type ResolvedTheme = "light" | "dark";

export interface ThemeSnapshot {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
}

export const THEME_STORAGE_KEY = "voct.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLOR_META_ID = "voct-theme-color";

/**
 * The browser-chrome colour per theme. These mirror `--color-ethereal-canvas`
 * in `panel.css` and must be changed with it: the meta paints the strip above
 * the app on installed iOS and the Android system bars, so a value that drifts
 * from the ground shows as a seam along the top edge of the screen. The light
 * one used to be `#f6f5f2` against a `#EBE5D9` canvas — exactly that seam.
 */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#EBE5D9",
  dark: "#14120F",
};

const isPreference = (value: string | null): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const readStoredPreference = (): ThemePreference => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(raw) ? raw : "system";
  } catch {
    // A locked-down browser throws on storage access. `system` is the default
    // anyway, so the control still works — it just forgets between sessions.
    return "system";
  }
};

const prefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? (prefersDark() ? "dark" : "light") : preference;

/**
 * `theme-color` is read from the FIRST meta in tree order whose media matches,
 * so this un-keyed one is prepended to <head> to outrank the media-keyed pair
 * in `index.html`. That pair stays as the pre-boot default; leaving it as the
 * only source would tie the browser chrome to the OS, and a member who forces
 * light inside a dark-mode phone would get a black status bar over a cream app.
 */
const applyThemeColor = (resolved: ResolvedTheme): void => {
  const existing = document.getElementById(THEME_COLOR_META_ID);
  let meta: HTMLMetaElement;
  if (existing instanceof HTMLMetaElement) {
    meta = existing;
  } else {
    meta = document.createElement("meta");
    meta.id = THEME_COLOR_META_ID;
    meta.name = "theme-color";
    // Immediately ahead of the media-keyed pair — and no further forward than
    // that, because <meta charset> has to stay the first child of <head>. With
    // no pair present the `null` target appends, which is equally correct: ours
    // is then the only candidate.
    document.head.insertBefore(
      meta,
      document.head.querySelector('meta[name="theme-color"]'),
    );
  }
  meta.content = THEME_COLOR[resolved];
};

const applyTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.setAttribute("data-theme", resolved);
  applyThemeColor(resolved);
};

const initialPreference = readStoredPreference();
let snapshot: ThemeSnapshot = {
  preference: initialPreference,
  resolved: resolve(initialPreference),
};

const listeners = new Set<() => void>();

const publish = (preference: ThemePreference): void => {
  const resolved = resolve(preference);
  if (
    preference === snapshot.preference &&
    resolved === snapshot.resolved
  ) {
    return; // no observable change — keep the reference stable for the store
  }
  snapshot = { preference, resolved };
  applyTheme(resolved);
  listeners.forEach((listener) => listener());
};

let initialized = false;
const initialize = (): void => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Idempotent re-stamp of what the inline snippet already wrote, so the
  // attribute is owned by exactly one module from here on.
  applyTheme(snapshot.resolved);

  // Held for the lifetime of the app rather than attached and detached with the
  // preference: it is one listener, and the guard below is what makes it a
  // no-op while the member has pinned light or dark.
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (snapshot.preference === "system") publish("system");
  });
};

initialize();

export const subscribeTheme = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getThemeSnapshot = (): ThemeSnapshot => snapshot;

export const setThemePreference = (preference: ThemePreference): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Best-effort: the choice still holds for this session, it just will not
    // survive a reload.
  }
  publish(preference);
};
