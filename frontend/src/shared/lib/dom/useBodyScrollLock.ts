/**
 * @file useBodyScrollLock.ts
 * @description Spatial-aware scroll locking mechanism.
 * Manages body overflow and scrollbar compensation to prevent layout shifts.
 * @module shared/lib/dom
 * @architecture Enterprise SaaS 2026
 */

import { useLayoutEffect } from "react";

type BodyLockSnapshot = {
  bodyOverflow: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
};

let activeBodyLockCount = 0;
let bodyLockSnapshot: BodyLockSnapshot | null = null;

const getScrollbarCompensation = (): number => {
  const root = document.documentElement;
  return Math.max(0, window.innerWidth - root.clientWidth);
};

const acquireBodyScrollLock = (): void => {
  const body = document.body;
  const html = document.documentElement;

  if (activeBodyLockCount === 0) {
    const computedStyle = window.getComputedStyle(body);
    const computedPaddingRight = Number.parseFloat(
      computedStyle.paddingRight || "0",
    );

    bodyLockSnapshot = {
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
    };

    // Compute the scrollbar gutter BEFORE we hide overflow, then lock both
    // <html> and <body>. The shell root is `min-h-screen`, so the document
    // scroller is <html>; locking <body> alone leaves the page scrollable
    // behind overlays on tall pages.
    const scrollbarCompensation = getScrollbarCompensation();

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

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

  if (bodyLockSnapshot) {
    const body = document.body;
    const html = document.documentElement;
    body.style.overflow = bodyLockSnapshot.bodyOverflow;
    body.style.paddingRight = bodyLockSnapshot.bodyPaddingRight;
    html.style.overflow = bodyLockSnapshot.htmlOverflow;
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
