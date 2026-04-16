/**
 * @file useFocusTrap.ts
 * @description Advanced focus management hook for modal components.
 * Ensures keyboard and screen reader accessibility by trapping focus within a defined scope.
 * Engineered with strict generic typings to support any HTMLElement RefObject.
 */

import { useEffect, RefObject } from "react";

export const useFocusTrap = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
): void => {
  useEffect(() => {
    if (!active || !ref.current) return;

    const element = ref.current;

    // Select all potentially focusable elements within the container
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // If Shift + Tab and on the first element, cycle to the last
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // If Tab and on the last element, cycle to the first
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    // Initially focus the first interactive element for A11y
    firstElement?.focus();

    element.addEventListener("keydown", handleTabKey);
    return () => element.removeEventListener("keydown", handleTabKey);
  }, [active, ref]);
};
