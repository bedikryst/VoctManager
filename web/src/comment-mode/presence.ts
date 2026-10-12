/**
 * @file presence.ts
 * @description Whether the comment mode is running in this window, for the site code that has to
 *  step aside while it does. The custom cursor is the reader: its ring (z 150) would float over the
 *  tool, and `.has-custom-cursor` hides the native pointer on the tool's own controls.
 *
 *  The mark lives on `window`, not on `<html>` or `<body>`: the client router replaces the body and
 *  rewrites every attribute of `<html>` on each navigation, so a reader re-checking in
 *  `astro:after-swap` could run before the mode had put a DOM mark back. A change is announced with
 *  one window event.
 *
 *  Tiny on purpose: the cursor island imports it on every page, for every visitor.
 * @architecture Astro islands 2026
 * @module comment-mode/presence
 */

declare global {
  interface Window {
    voctCommentMode?: boolean;
  }
}

const CHANGE_EVENT = "voct:comment-mode-change";

export function commentModeActive(): boolean {
  return window.voctCommentMode === true;
}

export function setCommentModeActive(active: boolean): void {
  if (commentModeActive() === active) return;
  window.voctCommentMode = active;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls `listener` whenever the mode starts or ends; returns the unsubscribe. */
export function onCommentModeChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
