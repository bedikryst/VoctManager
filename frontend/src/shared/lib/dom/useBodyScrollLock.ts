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

    // Lock both <html> and <body>. The shell root is `min-h-screen`, so the
    // document scroller is <html>; locking <body> alone leaves the page
    // scrollable behind overlays on tall pages.
    const bodyWidthBeforeLock = body.getBoundingClientRect().width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    // Pay back only the width the lock actually took. `html` declares
    // `scrollbar-gutter: stable` (panel.css), so wherever that is honoured the
    // gutter survives `overflow: hidden` and the body keeps its width. Measure
    // the body, not `html.clientWidth`: Chromium reports the root's clientWidth
    // as the full viewport once overflow is hidden, while the gutter is still
    // reserved in layout. Padding the body anyway narrows the page under the
    // overlay, and it springs back the moment a Radix Select or DropdownMenu
    // opens, because panel.css zeroes body padding under `data-scroll-locked`.
    const lostScrollbarWidth =
      body.getBoundingClientRect().width - bodyWidthBeforeLock;

    if (lostScrollbarWidth > 0) {
      body.style.paddingRight = `${computedPaddingRight + lostScrollbarWidth}px`;
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
