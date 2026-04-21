/**
 * @file useBodyScrollLock.ts
 * @description Spatial-aware scroll locking mechanism.
 * Keeps body scroll locking re-entrant and preserves opt-in nested scrollers
 * via the `data-scroll-lock-ignore="true"` attribute.
 * @module shared/lib/dom
 * @architecture Enterprise SaaS 2026
 */

import { useLayoutEffect } from "react";

type BodyLockSnapshot = {
  overflow: string;
  paddingRight: string;
};

const SCROLL_LOCK_IGNORE_SELECTOR = '[data-scroll-lock-ignore="true"]';
const NON_PASSIVE_EVENT_OPTIONS = { passive: false } as const;

let activeBodyLockCount = 0;
let bodyLockSnapshot: BodyLockSnapshot | null = null;
let activeScrollGuard: ((event: Event) => void) | null = null;

const getScrollbarCompensation = (): number => {
  const root = document.documentElement;
  return Math.max(0, window.innerWidth - root.clientWidth);
};

const attachScrollGuard = (): void => {
  if (activeScrollGuard) {
    return;
  }

  activeScrollGuard = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(SCROLL_LOCK_IGNORE_SELECTOR)) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
  };

  document.addEventListener("touchmove", activeScrollGuard, NON_PASSIVE_EVENT_OPTIONS);
  document.addEventListener("wheel", activeScrollGuard, NON_PASSIVE_EVENT_OPTIONS);
};

const detachScrollGuard = (): void => {
  if (!activeScrollGuard) {
    return;
  }

  document.removeEventListener("touchmove", activeScrollGuard);
  document.removeEventListener("wheel", activeScrollGuard);
  activeScrollGuard = null;
};

const acquireBodyScrollLock = (): void => {
  const body = document.body;

  if (activeBodyLockCount === 0) {
    const computedStyle = window.getComputedStyle(body);
    const computedPaddingRight = Number.parseFloat(computedStyle.paddingRight || "0");

    bodyLockSnapshot = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };

    body.style.overflow = "hidden";

    const scrollbarCompensation = getScrollbarCompensation();
    if (scrollbarCompensation > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarCompensation}px`;
    }

    attachScrollGuard();
  }

  activeBodyLockCount += 1;
};

const releaseBodyScrollLock = (): void => {
  if (activeBodyLockCount === 0) {
    return;
  }

  activeBodyLockCount -= 1;

  if (activeBodyLockCount > 0) {
    return;
  }

  const body = document.body;

  if (bodyLockSnapshot) {
    body.style.overflow = bodyLockSnapshot.overflow;
    body.style.paddingRight = bodyLockSnapshot.paddingRight;
    bodyLockSnapshot = null;
  }

  detachScrollGuard();
};

export const useBodyScrollLock = (isLocked: boolean): void => {
  useLayoutEffect(() => {
    if (!isLocked) {
      return;
    }

    acquireBodyScrollLock();

    return () => {
      releaseBodyScrollLock();
    };
  }, [isLocked]);
};
