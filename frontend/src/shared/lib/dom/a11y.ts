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
 */
export const onActivate =
  <T extends HTMLElement>(handler: () => void) =>
  (event: KeyboardEvent<T>): void => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      handler();
    }
  };
