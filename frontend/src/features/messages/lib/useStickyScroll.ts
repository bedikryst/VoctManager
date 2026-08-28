/**
 * @file useStickyScroll.ts
 * @description Keeps a message stream pinned to its newest message — but only
 * while the reader is actually there.
 *
 * An open conversation refetches every ten seconds, so an effect that scrolls on
 * every change of the message count throws a reader who has gone back through
 * the history down to the bottom, repeatedly, without them having done anything.
 * The reader's own send is the exception: it must always land in view, whatever
 * they were looking at when they typed it.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/lib/useStickyScroll
 */

import { useCallback, useEffect, useRef } from "react";

/**
 * How close to the end still counts as "reading the newest". Generous enough to
 * survive a half-scrolled last bubble, short enough that a reader one message
 * back is left alone.
 */
const BOTTOM_THRESHOLD_PX = 120;

export interface StickyScroll {
  /** Ref for the scrolling element. */
  readonly ref: React.RefObject<HTMLDivElement | null>;
  /** Wire to the element's `onScroll` — this is what tracks the reader. */
  readonly onScroll: () => void;
  /** Re-arm after an act of the reader's own (sending) that must land in view. */
  readonly pinToBottom: () => void;
}

/**
 * @param messageCount changes whenever the stream gains a message — the moment a
 *   decision about scrolling has to be made.
 */
export const useStickyScroll = (messageCount: number): StickyScroll => {
  const ref = useRef<HTMLDivElement>(null);
  // Opens pinned: a conversation is entered at its newest message.
  const isPinned = useRef(true);

  const onScroll = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const distanceFromEnd =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    isPinned.current = distanceFromEnd < BOTTOM_THRESHOLD_PX;
  }, []);

  const pinToBottom = useCallback(() => {
    isPinned.current = true;
  }, []);

  useEffect(() => {
    if (!isPinned.current) return;
    const element = ref.current;
    element?.scrollTo({ top: element.scrollHeight });
  }, [messageCount]);

  return { ref, onScroll, pinToBottom };
};
