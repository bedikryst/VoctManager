/**
 * @file PageTransition.tsx
 * @description The panel's route entrance — the ONE ramp a page is allowed.
 *
 * It carries the ink law (`INK` in motion-presets): the page waits at half-ink
 * and is inked to full, and it does not travel. A surface that entered from
 * `opacity: 0` was a hole that then filled itself in, and for the length of a
 * `y` it was a composited layer per page; neither buys anything a reader wants.
 *
 * There is deliberately no `exit`. Nothing above this wraps it in an
 * `AnimatePresence`, so an exit variant would be dead configuration — and under
 * the law the outgoing page has nowhere to fade TO. The shell hands over by
 * remounting on its route key; this is the arrival half, and the only half.
 *
 * @module shared/ui/kinematics/PageTransition
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";

import { cn } from "@/shared/lib/utils";
import { INK } from "./motion-presets";

interface PageTransitionProps {
  children: React.ReactNode;
  /**
   * Layout escape hatch, merged through `cn()`. The `min-h-screen` below is
   * this component owning something that belongs to the caller: it is right
   * under the panel shell, where the page starts at the top of the viewport,
   * and wrong under any shell that puts a band above it — there the short
   * states scroll by exactly the height of that band. A caller in that position
   * passes `min-h-0`; everyone else passes nothing and renders as before.
   */
  className?: string;
}

export const PageTransition = ({
  children,
  className,
}: PageTransitionProps): React.JSX.Element => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: INK.half }}
      animate={{ opacity: 1 }}
      transition={{ duration: INK.in, ease: INK.ease }}
      className={cn("w-full min-h-screen", className)}
    >
      {children}
    </motion.div>
  );
};
