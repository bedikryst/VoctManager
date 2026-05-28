/**
 * @file useFocusTrap.ts
 * @description Locks Tab focus inside the referenced element while `active` is true.
 * Returns focus to the previously focused element on deactivation. Honors Escape via
 * the optional onEscape callback.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useFocusTrap
 */

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  options: { readonly onEscape?: () => void; readonly focusInitial?: boolean } = {},
): void {
  const { onEscape, focusInitial = true } = options;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previousActive = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("inert") && el.offsetParent !== null,
      );

    if (focusInitial) {
      window.requestAnimationFrame(() => {
        const target = root.matches(FOCUSABLE_SELECTOR) ? root : focusables()[0];
        target?.focus({ preventScroll: true });
      });
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const targets = focusables();
      if (!targets.length) {
        event.preventDefault();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousActive?.focus?.({ preventScroll: true });
    };
  }, [ref, active, onEscape, focusInitial]);
}
