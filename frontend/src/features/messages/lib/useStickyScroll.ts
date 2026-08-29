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

import { useCallback, useLayoutEffect, useRef } from "react";

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
  /**
   * Call in the same tick as a prepend of older history, BEFORE React commits
   * it: the line being read is held in place while the page grows above it.
   * Safari implements no scroll anchoring of its own, so this is the only thing
   * standing between "earlier messages" and the reader losing their place.
   */
  readonly anchorTop: () => void;
}

/**
 * @param messageCount changes whenever the stream gains a message — the moment a
 *   decision about scrolling has to be made.
 * @param layoutRevision changes whenever what is ALREADY rendered gets taller or
 *   shorter without gaining a message — the reading size. The browser keeps
 *   `scrollTop` through such a reflow, so a reader sitting at the newest message
 *   is quietly left behind it unless the same decision is made again.
 */
export const useStickyScroll = (
  messageCount: number,
  layoutRevision?: string | number,
): StickyScroll => {
  const ref = useRef<HTMLDivElement>(null);
  // Opens pinned: a conversation is entered at its newest message.
  const isPinned = useRef(true);
  /** Distance from the reader's position to the end, measured before a prepend. */
  const anchor = useRef<number | null>(null);

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

  const anchorTop = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    anchor.current = element.scrollHeight - element.scrollTop;
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const held = anchor.current;
    if (held !== null) {
      // Older history landed above the reader — restore the distance to the end
      // and stop: a prepend is never a reason to jump to the newest message.
      anchor.current = null;
      element.scrollTop = element.scrollHeight - held;
      return;
    }
    if (!isPinned.current) return;
    element.scrollTo({ top: element.scrollHeight });
  }, [messageCount, layoutRevision]);

  return { ref, onScroll, pinToBottom, anchorTop };
};
