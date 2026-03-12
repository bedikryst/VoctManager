/**
 * @file PageTransition.jsx
 * @description Cinematic page transition wrapper.
 * Utilizes Framer Motion to create a soft, editorial crossfade and blur effect 
 * between route changes, preventing harsh browser reloads.
 * @author Krystian Bugalski
 */

import { motion } from 'framer-motion';
import { useEffect } from 'react';

export default function PageTransition({ children }) {
  // Automatycznie scrolluje stronę na samą górę przy zmianie podstrony
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full min-h-screen bg-[#fdfbf7]"
    >
      {children}
    </motion.div>
  );
}