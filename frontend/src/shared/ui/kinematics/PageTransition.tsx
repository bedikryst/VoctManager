/**
 * @file PageTransition.tsx
 * @description Cinematic page transition wrapper for the public zone.
 * Utilises Framer Motion to create a soft, editorial crossfade and blur effect.
 * @module shared/ui/kinematics/PageTransition
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      className="w-full min-h-screen"
    >
      {children}
    </motion.div>
  );
};
