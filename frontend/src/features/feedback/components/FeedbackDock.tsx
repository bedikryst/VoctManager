/**
 * @file FeedbackDock.tsx
 * @description The always-available way to report something, and the sheet it
 * opens.
 *
 * Anchoring: this renders as a member of the shell's bottom-dock column, not as
 * its own fixed element. That column already owns the band above the mobile nav
 * and stacks whatever is transiently in it (offline badge, install prompt), so
 * joining it is what keeps a permanent button from landing on top of a pill that
 * appears without warning — flexbox spaces them, nothing has to guess the other's
 * height. It stays BELOW the nav's own z-layer: a floating button that paints
 * over navigation is a trap, not an affordance, which also means every modal and
 * sheet simply covers it.
 * @architecture Enterprise SaaS 2026
 * @module features/feedback/components/FeedbackDock
 */

import React, { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MessageCircleHeart } from "lucide-react";

import { useFeedbackStore } from "@/app/store/useFeedbackStore";
import { cn } from "@/shared/lib/utils";
import { installErrorTrail } from "../lib/errorTrail";
import { FeedbackSheet } from "./FeedbackSheet";

export const FeedbackDock = (): React.JSX.Element => {
  const { t } = useTranslation();
  const openFeedback = useFeedbackStore((state) => state.openFeedback);
  const isOpen = useFeedbackStore((state) => state.isOpen);
  const prefersReducedMotion = useReducedMotion();

  // Mounted once with the shell, so this is where the ambient error listeners
  // belong — they must already be watching when the fault the member reports
  // actually happens.
  useEffect(() => installErrorTrail(), []);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => openFeedback()}
        aria-label={t("feedback.dock.aria", "Zgłoś problem lub pomysł")}
        title={t("feedback.dock.aria", "Zgłoś problem lub pomysł")}
        // Faded out behind the open sheet, so it also leaves the tab order —
        // an invisible control that still takes focus is worse than a visible one.
        aria-hidden={isOpen}
        tabIndex={isOpen ? -1 : 0}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={
          prefersReducedMotion
            ? undefined
            : { opacity: isOpen ? 0 : 1, scale: isOpen ? 0.8 : 1 }
        }
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "pointer-events-auto mr-4 flex size-12 shrink-0 items-center justify-center self-end rounded-full sm:mr-6",
          "border border-ethereal-gold/30 bg-ethereal-alabaster/85 text-ethereal-gold shadow-glass-solid backdrop-blur-md",
          "transition-colors hover:border-ethereal-gold/60 hover:text-ethereal-ink active:scale-[0.94]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
          isOpen && "pointer-events-none",
        )}
      >
        <MessageCircleHeart size={20} strokeWidth={1.6} aria-hidden="true" />
      </motion.button>

      <FeedbackSheet />
    </>
  );
};

FeedbackDock.displayName = "FeedbackDock";
