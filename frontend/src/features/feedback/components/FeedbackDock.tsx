/**
 * @file FeedbackDock.tsx
 * @description The always-available way to report something, and the sheet it
 * opens.
 *
 * Anchoring: this renders as a member of the shell's ambient floating column, not
 * as its own fixed element. That column already owns the band above the mobile
 * nav and stacks whatever is transiently in it (offline badge, install prompt),
 * so joining it is what keeps a permanent button from landing on top of a pill
 * that appears without warning — flexbox spaces them, nothing has to guess the
 * other's height. The column in turn rides above whatever contextual bar owns the
 * band below it (see the `floating-dock` utility), which is what stops a save bar
 * or the practice player from burying the one control a member reaches for when
 * something has gone wrong.
 *
 * It stays BELOW the nav's own z-layer: a floating button that paints over
 * navigation is a trap, not an affordance, which also means every modal and sheet
 * simply covers it.
 *
 * Side: right with a mouse, where the page's column stops well short of it. On
 * touch, where the column runs to the screen's edge, it stands on the left: the
 * right edge is every list row's actions column (`RecordRow`'s menu), and a
 * button parked there took the tap meant for the menu of whichever row passed
 * under it. On the left it covers the start of a title, so on touch it also
 * steps out of the way while the page scrolls down, and returns when the page
 * scrolls back up or comes to rest.
 * @module features/feedback/components/FeedbackDock
 */

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MessageCircleHeart } from "lucide-react";

import { useFeedbackStore } from "@/app/store/useFeedbackStore";
import { cn } from "@/shared/lib/utils";
import { installErrorTrail } from "../lib/errorTrail";
import { FeedbackSheet } from "./FeedbackSheet";

/** Matches the `fine-pointer:` variant in `panel.css`: a mouse never hides it. */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";
/** Movement smaller than this is a finger settling, not a direction. */
const SCROLL_JITTER_PX = 6;
/** Near the top nothing sits under the button yet. */
const TOP_ZONE_PX = 80;
/** How long the page must be still before the button comes back. */
const REST_DELAY_MS = 700;

/**
 * True while a touch page is being scrolled down. The shell scrolls the window
 * itself, so the window's offset is the one to follow; a page that scrolls an
 * inner element never hides the button, which is the safe failure.
 */
const useScrollingDown = (): boolean => {
  const [scrollingDown, setScrollingDown] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia(FINE_POINTER);
    let lastY = window.scrollY;
    let restTimer: number | undefined;

    const onScroll = (): void => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < SCROLL_JITTER_PX) return;
      lastY = y;
      if (finePointer.matches) return;

      setScrollingDown(delta > 0 && y > TOP_ZONE_PX);
      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(() => setScrollingDown(false), REST_DELAY_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(restTimer);
    };
  }, []);

  return scrollingDown;
};

export const FeedbackDock = (): React.JSX.Element => {
  const { t } = useTranslation();
  const openFeedback = useFeedbackStore((state) => state.openFeedback);
  const isOpen = useFeedbackStore((state) => state.isOpen);
  const prefersReducedMotion = useReducedMotion();
  const scrollingDown = useScrollingDown();

  // Mounted once with the shell, so this is where the ambient error listeners
  // belong — they must already be watching when the fault the member reports
  // actually happens.
  useEffect(() => installErrorTrail(), []);

  const stepsAside = scrollingDown && !isOpen;
  const transform = isOpen
    ? "translateY(0px) scale(0.8)"
    : stepsAside
      ? "translateY(16px) scale(1)"
      : "translateY(0px) scale(1)";

  return (
    <>
      <motion.button
        type="button"
        onClick={() => openFeedback()}
        aria-label={t("feedback.dock.aria", "Zgłoś problem lub pomysł")}
        title={t("feedback.dock.aria", "Zgłoś problem lub pomysł")}
        // Faded out behind the open sheet, so it also leaves the tab order —
        // an invisible control that still takes focus is worse than a visible one.
        // Stepping aside during a scroll is momentary, so it keeps its place in
        // the order and stays announced.
        aria-hidden={isOpen}
        tabIndex={isOpen ? -1 : 0}
        initial={prefersReducedMotion ? false : { opacity: 0, transform: "translateY(0px) scale(0.8)" }}
        animate={
          prefersReducedMotion
            ? { opacity: isOpen || stepsAside ? 0 : 1 }
            : { opacity: isOpen || stepsAside ? 0 : 1, transform }
        }
        transition={
          prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
        }
        className={cn(
          "pointer-events-auto ml-4 flex size-12 shrink-0 items-center justify-center self-start rounded-full sm:ml-6",
          "fine-pointer:ml-0 fine-pointer:mr-6 fine-pointer:self-end",
          "border border-ethereal-gold/30 bg-ethereal-alabaster/85 text-ethereal-gold shadow-glass-solid backdrop-blur-md",
          "transition-colors hover:border-ethereal-gold/60 hover:text-ethereal-ink active:scale-[0.94]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
          (isOpen || stepsAside) && "pointer-events-none",
        )}
      >
        <MessageCircleHeart size={20} strokeWidth={1.6} aria-hidden="true" />
      </motion.button>

      <FeedbackSheet />
    </>
  );
};

FeedbackDock.displayName = "FeedbackDock";
