/**
 * @file useScrollSpy.ts
 * @description Which of a page's sections the reader is in. A section is
 * current once its top has passed a line `offset` pixels below the top of the
 * scroller, which is where a sticky index ends. At the end of the scroll the
 * last section is current even when it is too short to reach that line.
 *
 * A section chosen from the index is pinned until the reader scrolls by hand:
 * a short section near the end cannot be scrolled up to the line, and without
 * the pin the index would light the section below the one just chosen.
 * @module shared/lib/dom/useScrollSpy
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Inputs that only a reader produces; a programmatic scroll fires none. */
const HAND_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** Slack for subpixel scroll positions at the end of the scroller. */
const END_SLACK_PX = 2;

interface ScrollSpyOptions {
  /** Section element ids, in document order. */
  readonly ids: readonly string[];
  /** The element that scrolls; null for the window. */
  readonly root: HTMLElement | null;
  /** Height of whatever is stuck to the scroller's top, in pixels. */
  readonly offset: number;
}

interface ScrollSpy {
  readonly activeId: string | null;
  /** Holds `id` as current until the reader next scrolls by hand. */
  readonly pin: (id: string) => void;
}

const isAtEnd = (root: HTMLElement | null): boolean => {
  if (root) return root.scrollTop + root.clientHeight >= root.scrollHeight - END_SLACK_PX;
  const page = document.documentElement;
  return window.scrollY + window.innerHeight >= page.scrollHeight - END_SLACK_PX;
};

const currentSection = (ids: readonly string[], root: HTMLElement | null, offset: number): string | null => {
  const present = ids.filter((id) => document.getElementById(id));
  if (present.length === 0) return null;
  if (isAtEnd(root)) return present[present.length - 1] ?? null;
  const line = (root ? root.getBoundingClientRect().top : 0) + offset;
  let active = present[0] ?? null;
  for (const id of present) {
    const top = document.getElementById(id)?.getBoundingClientRect().top;
    if (top !== undefined && top <= line + 1) active = id;
  }
  return active;
};

export const useScrollSpy = ({ ids, root, offset }: ScrollSpyOptions): ScrollSpy => {
  const [computed, setComputed] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const frame = useRef<number | null>(null);
  const idsKey = ids.join("|");

  useEffect(() => {
    const sectionIds = idsKey ? idsKey.split("|") : [];
    const measure = (): void => {
      frame.current = null;
      setComputed(currentSection(sectionIds, root, offset));
    };
    const schedule = (): void => {
      if (frame.current === null) frame.current = requestAnimationFrame(measure);
    };
    const release = (): void => setPinned(null);
    const scroller: HTMLElement | Window = root ?? window;
    measure();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    for (const type of HAND_EVENTS) scroller.addEventListener(type, release, { passive: true });
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      for (const type of HAND_EVENTS) scroller.removeEventListener(type, release);
    };
  }, [idsKey, root, offset]);

  const pin = useCallback((id: string): void => setPinned(id), []);
  const activeId = pinned && ids.includes(pinned) ? pinned : computed;
  return { activeId, pin };
};
