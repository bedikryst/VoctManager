/**
 * @file ConversationSurface.tsx
 * @description The phone chassis for an open conversation: the whole screen,
 * three fixed bands (header / stream / composer), nothing else.
 *
 * On a phone a conversation was a card inside a padded page under a page header
 * that kept announcing "Wiadomości / + NOWA" while you were reading one — three
 * nested paddings costing 45% of the screen's width, and a bottom band the nav
 * dock and the feedback button were both already standing in. It is a surface
 * now: portalled out of the page's stacking context, sized to the viewport,
 * yielding only to the display's own cutouts and to the keyboard.
 *
 * It is a ROUTE, not a dialog — the back arrow and the hardware back button both
 * work through the router — but it takes `z-focus-trap` because that is the rung
 * for a surface the member opened, and it locks the document because iOS
 * rubber-bands whatever sits behind a fixed overlay. The desktop keeps its
 * two-pane card and never mounts this.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { motion } from "framer-motion";

import { Portal } from "@/shared/lib/dom/Portal";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useKeyboardInset } from "@/shared/lib/dom/useKeyboardInset";
import { INK } from "@/shared/ui/kinematics/motion-presets";

interface ConversationSurfaceProps {
  children: React.ReactNode;
}

export const ConversationSurface: React.FC<ConversationSurfaceProps> = ({
  children,
}) => {
  const bindKeyboardInset = useKeyboardInset();
  useBodyScrollLock(true);

  return (
    <Portal>
      <motion.div
        ref={bindKeyboardInset}
        initial={{ opacity: INK.half }}
        animate={{ opacity: 1 }}
        transition={{ duration: INK.in, ease: INK.ease }}
        // The bottom pad is the larger of the keyboard's own band and the home
        // indicator's: exactly one of the two is ever non-zero, and reading it as
        // a max means neither has to know about the other.
        className="fixed inset-0 z-focus-trap flex flex-col overflow-hidden bg-ethereal-alabaster pt-[env(safe-area-inset-top)] pb-[max(var(--keyboard-inset,0px),env(safe-area-inset-bottom))]"
      >
        {children}
      </motion.div>
    </Portal>
  );
};

ConversationSurface.displayName = "ConversationSurface";
