/**
 * @file a11y.ts
 * @description Small accessibility helpers for making non-button elements
 * (cards, rows) keyboard-operable without rewriting them as native buttons.
 */

import type { KeyboardEvent } from "react";

/**
 * Returns an onKeyDown handler that fires `handler` on Enter / Space, matching
 * native button semantics. Pair with `role="button"` + `tabIndex={0}` on the
 * clickable element.
 *
 * Only a keystroke aimed at the element ITSELF activates it. A row that carries
 * its own controls — an inline-edit input, a checkbox, a select — receives their
 * keystrokes by bubbling, and a native `<button>` never sees those at all. Acting
 * on them swallows the space bar of whoever is typing in the field and collapses
 * the row out from under them.
 */
export const onActivate =
  <T extends HTMLElement>(handler: () => void) =>
  (event: KeyboardEvent<T>): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      handler();
    }
  };
