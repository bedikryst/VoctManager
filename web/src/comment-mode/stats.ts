/**
 * @file stats.ts
 * @description Keeps the editor's visits and clicks out of the site's statistics while the comment
 *  mode runs. Plausible's script reads `localStorage.plausible_ignore` on every event it would
 *  send, pageviews and goals alike, and drops the event when it is "true".
 *
 *  The value it had before comes back on "Zakończ", and when the server turns the reader away
 *  (signed out, or an account that may not edit): somebody who already excluded their browser
 *  (the developer, a board member) stays excluded. The earlier value is stored once, beside the
 *  flag, so a second start on the next page load does not overwrite it with the mode's own "true".
 *
 *  The pageview of the very load that carried `?uwagi` is counted: Plausible's deferred script
 *  runs before the loader's module. Every later one is not.
 * @architecture Astro islands 2026
 * @module comment-mode/stats
 */

const IGNORE = "plausible_ignore";
const BEFORE = "voct:comment-mode:plausible-before";

/** Plausible ignores this browser until `restoreStats`. */
export function silenceStats(): void {
  try {
    const storage = window.localStorage;
    if (storage.getItem(BEFORE) === null) storage.setItem(BEFORE, JSON.stringify(storage.getItem(IGNORE)));
    storage.setItem(IGNORE, "true");
  } catch {
    // Storage refused: the editor's visits count, and nothing else is affected.
  }
}

/** Put back whatever `plausible_ignore` held before the mode started. */
export function restoreStats(): void {
  try {
    const storage = window.localStorage;
    const raw = storage.getItem(BEFORE);
    if (raw === null) return;
    const before: unknown = JSON.parse(raw);
    if (typeof before === "string") storage.setItem(IGNORE, before);
    else storage.removeItem(IGNORE);
    storage.removeItem(BEFORE);
  } catch {
    // Storage refused: there is nothing of ours to put back.
  }
}
