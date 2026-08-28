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

import { INK } from "./motion-presets";

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({
  children,
}: PageTransitionProps): React.JSX.Element => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: INK.half }}
      animate={{ opacity: 1 }}
      transition={{ duration: INK.in, ease: INK.ease }}
      className="w-full min-h-screen"
    >
      {children}
    </motion.div>
  );
};
