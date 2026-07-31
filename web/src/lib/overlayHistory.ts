/**
 * @file overlayHistory.ts
 * @description History integration for dismissible overlays (the "Antyfona" nav card, the vault
 *  sheet, the video lightbox): opening pushes a hash-marked entry so the mobile back button /
 *  edge-swipe dismisses the overlay instead of leaving the page. The push goes THROUGH
 *  ClientRouter's own `navigate()` — the router's internal bookkeeping (`originalLocation`,
 *  history index) then knows the hash, so consuming the entry (back) takes its same-page hash
 *  path: pure scroll restore, NO document swap, no `astro:page-load`. A raw `history.pushState`
 *  CANNOT achieve this: the router never learns the hash, treats the back traversal as a
 *  same-URL navigation and swaps the whole document — page scripts/reveals re-run and the
 *  outgoing View Transition snapshot ghosts the overlay back mid-close.
 *
 *  Leaving the page from inside an open overlay goes through `navigateFromOverlay`, which spends
 *  the pushed entry rather than stacking the destination on top of it — see its own note.
 * @architecture Astro islands 2026
 * @module lib/overlayHistory
 */

import { navigate } from "astro:transitions/client";

/** One flag per overlay, so stacked overlays (vault opened from the nav card) each own an entry. */
export type OverlayFlag = "navOpen" | "vaultOpen" | "videoOpen";

/** True when the CURRENT history entry is the overlay's own pushed entry. */
export const isOverlayEntry = (flag: OverlayFlag): boolean =>
  Boolean((history.state as Record<string, unknown> | null)?.[flag]);

/**
 * Push the overlay's history entry. No-op when the current entry already carries the flag —
 * a stranded entry (left when a page swap tore the overlay down) is simply reused. The hash
 * must NOT match any real element id, or the browser scrolls to it on open.
 *
 * `navigate()`'s same-page hash path runs synchronously through `pushState`, so the follow-up
 * merge below lands on OUR entry: it restores the real scroll position that the router
 * hardcodes to 0 on push (otherwise a forward re-traversal onto the entry jumps to top).
 */
export function pushOverlayEntry(flag: OverlayFlag, hash: string): void {
  if (isOverlayEntry(flag)) return;
  void navigate(`#${hash}`, { state: { [flag]: true } });
  history.replaceState({ ...history.state, scrollX: window.scrollX, scrollY: window.scrollY }, "");
}

/**
 * User-initiated close (Zamknij / ✕ / Escape / backdrop): pop the entry pushed on open
 * (→ popstate → close) so no "swallowed" back press lingers — the popstate round-trip is the
 * single close path shared with a genuine back press. Falls back to closing directly when our
 * entry isn't on top (defensive).
 *
 * Popstate listeners MUST gate on `!isOverlayEntry(flag)`: the router may dispatch a synthetic
 * popstate right after the open-push (state-nulling browsers), and a forward re-traversal onto
 * a stranded entry also fires one — neither is a dismissal.
 */
export function dismissOverlayEntry(flag: OverlayFlag, closeDirectly: () => void): void {
  if (isOverlayEntry(flag)) history.back();
  else closeDirectly();
}

/**
 * Leave the page from inside an open overlay, CONSUMING the entry it pushed instead of stranding
 * it. A plain `navigate()` pushes the destination on top of the overlay's entry, so the first back
 * press lands on that shadow — same page, hash only — and the router's same-page hash path runs:
 * no swap, nothing visible. The press is simply eaten, which on touch reads as a broken back
 * button. `history: "replace"` puts the destination WHERE the overlay's entry was, so back returns
 * to the page the visitor actually came from, once.
 *
 * Two things `replace` does not do for us, both compensated here:
 *  - Astro copies the CURRENT entry's stored scroll onto a replaced entry (a push would zero it),
 *    so a later back→forward onto this page would restore the previous page's offset. Re-stamp it
 *    with where the visitor actually landed.
 *  - Plausible hooks `pushState`, never `replaceState` — a replaced navigation is invisible to it.
 *    Without this call every menu-driven navigation would silently stop being counted, which on a
 *    mobile-first site is most of them. `plausible()` is its documented manual-tracking entry
 *    point; the optional call covers dev (no script) and blocked-script visitors.
 */
export async function navigateFromOverlay(flag: OverlayFlag, href: string): Promise<void> {
  if (!isOverlayEntry(flag)) {
    await navigate(href);
    return;
  }
  await navigate(href, { history: "replace" });
  history.replaceState(
    { ...history.state, scrollX: window.scrollX, scrollY: window.scrollY },
    "",
  );
  (window as Window & { plausible?: (event: string) => void }).plausible?.("pageview");
}
