/**
 * @file useBodyScrollLock.ts
 * @description Spatial-aware scroll locking mechanism.
 * Implements cross-browser body scroll lock while preserving nested scrolling capabilities
 * via 'data-scroll-lock-ignore' attribute delegation.
 * Supports both tactile (touchmove) and desktop testing (wheel) scenarios seamlessly.
 * @module shared/lib/dom
 * @architecture Enterprise SaaS 2026
 */

import { useLayoutEffect } from "react";

export const useBodyScrollLock = (isLocked: boolean): void => {
  useLayoutEffect(() => {
    if (!isLocked) return;

    const body = document.body;
    const root = document.documentElement;

    // Cache original spatial styles
    const originalStyle = window.getComputedStyle(body);
    const originalOverflow = originalStyle.overflow;
    const originalPaddingRight = originalStyle.paddingRight;

    // Calculate scrollbar width to prevent UI layout shift on desktops
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    // Apply visual lock
    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `calc(${originalPaddingRight} + ${scrollbarWidth}px)`;
    }

    /**
     * Intercepts both touchmove and wheel globally, delegating permission
     * based on spatial attributes (data-scroll-lock-ignore="true").
     * Safely handles non-Element targets (like text nodes).
     */
    const handleScrollEvent = (event: Event) => {
      const target = event.target as Node | null;

      // Spatial routing: Ignore non-element nodes safely
      if (!target || target.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      // Traverse DOM to find if any spatial parent has the bypass flag
      const element = target as Element;
      const isIgnored = element.closest('[data-scroll-lock-ignore="true"]');

      if (isIgnored) {
        // Nested container is marked as spatially scrollable. Native kinematics take over.
        return;
      }

      // Block scrolling for non-marked elements
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    // Non-passive listeners are strictly required to reliably prevent default scroll events
    const eventOptions = { passive: false };
    document.addEventListener("touchmove", handleScrollEvent, eventOptions);
    document.addEventListener("wheel", handleScrollEvent, eventOptions);

    return () => {
      // Restore exact spatial state
      body.style.overflow = originalOverflow;
      body.style.paddingRight = originalPaddingRight;
      document.removeEventListener("touchmove", handleScrollEvent);
      document.removeEventListener("wheel", handleScrollEvent);
    };
  }, [isLocked]);
};
