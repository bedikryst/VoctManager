/**
 * @file useBodyScrollLock.ts
 * @description Spatial-aware scroll locking mechanism.
 * Manages body overflow and scrollbar compensation to prevent layout shifts.
 * @module shared/lib/dom
 * @architecture Enterprise SaaS 2026
 */

import { useLayoutEffect } from "react";

type BodyLockSnapshot = {
  overflow: string;
  paddingRight: string;
};

let activeBodyLockCount = 0;
let bodyLockSnapshot: BodyLockSnapshot | null = null;

const getScrollbarCompensation = (): number => {
  const root = document.documentElement;
  return Math.max(0, window.innerWidth - root.clientWidth);
};

const acquireBodyScrollLock = (): void => {
  const body = document.body;

  if (activeBodyLockCount === 0) {
    const computedStyle = window.getComputedStyle(body);
    const computedPaddingRight = Number.parseFloat(
      computedStyle.paddingRight || "0",
    );

    bodyLockSnapshot = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };

    body.style.overflow = "hidden";

    const scrollbarCompensation = getScrollbarCompensation();
    if (scrollbarCompensation > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarCompensation}px`;
    }
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
