/**
 * @file PageTransition.tsx
 * @description Cinematic page transition wrapper for the public zone.
 * Utilizes Framer Motion to create a soft, editorial crossfade and blur effect 
 * between route changes. 
 * Note: Should NOT be used inside the SaaS Dashboard to preserve snappy navigation.
 * @architecture Enterprise 2026 Standards
 * @author Krystian Bugalski
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps): React.JSX.Element {
  // Forces viewport to the top of the page upon route initialization
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      className="w-full min-h-screen bg-[#fdfbf7]"
    >
      {children}
    </motion.div>
  );
}