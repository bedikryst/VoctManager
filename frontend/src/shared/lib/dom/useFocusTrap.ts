/**
 * @file useFocusTrap.ts
 * @description Keeps Tab and Shift+Tab inside a modal surface while it is
 * active, and moves focus to its first tabbable element when it opens.
 *
 * The tabbable elements are looked up on every Tab, not once at opening: a
 * modal's content changes while it is open (a button that becomes disabled, a
 * confirmation that replaces a form), and a stale "last element" lets focus
 * walk out into the page behind. Elements outside the tab order (disabled, or
 * `tabindex="-1"` as in a roving-tabindex group) are skipped.
 */

import { useEffect, type RefObject } from "react";

const TABBABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const tabbablesIn = (element: HTMLElement): HTMLElement[] =>
  Array.from(element.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (node) =>
      node.tabIndex !== -1 &&
      !node.hasAttribute("disabled") &&
      node.getClientRects().length > 0,
  );

export const useFocusTrap = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
): void => {
  useEffect(() => {
    if (!active || !ref.current) return;

    const element = ref.current;

    const handleTabKey = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;
      const tabbables = tabbablesIn(element);
      if (tabbables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const current = document.activeElement;
      // The surface's own root counts as "before the first element".
      const atStart = current === element || current === first;

      if (event.shiftKey && atStart) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && current === last) {
        first.focus();
        event.preventDefault();
      }
    };

    tabbablesIn(element)[0]?.focus();

    // On the surface, not the document, so a trap nested inside another only
    // answers for its own content. A click on a non-focusable part of the
    // surface drops focus to <body>, out of this listener's reach, unless the
    // surface itself takes focus: give its root `tabIndex={-1}`.
    element.addEventListener("keydown", handleTabKey);
    return () => element.removeEventListener("keydown", handleTabKey);
  }, [active, ref]);
};
