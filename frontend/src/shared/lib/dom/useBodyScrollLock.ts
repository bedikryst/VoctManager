/**
 * @file useBodyScrollLock.ts
 * @description Enterprise-grade hook for managing global scroll locks.
 * Safely disables body scrolling when modals or side-panels are active.
 * Automatically calculates and compensates for scrollbar width to prevent UI layout shift.
 * @module hooks/useBodyScrollLock
 */

import { useLayoutEffect } from "react";

export const useBodyScrollLock = (isLocked: boolean): void => {
  useLayoutEffect(() => {
    if (!isLocked) return;

    // Cache original styles to ensure safe restoration
    const originalOverflow = window.getComputedStyle(document.body).overflow;
    const originalPaddingRight = window.getComputedStyle(
      document.body,
    ).paddingRight;

    // Calculate scrollbar width to prevent layout shifting
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    // Apply lock and padding compensation
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `calc(${originalPaddingRight} + ${scrollbarWidth}px)`;
    }

    // Cleanup function executes on unmount or when dependencies change
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
};
