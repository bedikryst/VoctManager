/**
 * @file CustomCursor.jsx
 * @description A high-performance, physics-based custom cursor.
 * Utilizes Framer Motion's useMotionValue to bypass React's render cycle 
 * during mouse movement, ensuring a strict 60fps fluid animation.
 * @author Krystian Bugalski
 */

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useCursor } from '../../context/CursorContext';

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function CustomCursor() {
  const { cursorType } = useCursor();

  // --- KINEMATICS & PHYSICS ---
  // Initialized off-screen to prevent flickering on mount
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Spring configuration tuned for a fluid, slight trailing effect
  const springConfig = { damping: 22, stiffness: 200, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  // --- EVENT BINDING ---
  useEffect(() => {
    const moveCursor = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    
    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, [mouseX, mouseY]);

  // ==========================================
  // STATE DEFINITIONS
  // ==========================================
  
  const variants = {
    default: {
      width: 10,
      height: 10,
      backgroundColor: "rgba(168, 162, 158, 0.6)",
      x: "-50%",
      y: "-50%",
      backdropFilter: "blur(0px)",
      border: "0px solid rgba(168, 162, 158, 0)",
    },
    drag: {
      width: 30,
      height: 30,
      backgroundColor: "rgba(165, 163, 159, 0.2)",
      backdropFilter: "blur(4px)",
      border: "1px solid rgba(168, 162, 158, 0.4)",
      x: "-50%",
      y: "-50%",
    },
    pointer: {
      width: 0,
      height: 0,
      backgroundColor: "rgba(168, 162, 158, 0.6)",
      x: "-50%",
      y: "-50%",
      backdropFilter: "blur(0px)",
      border: "0px solid rgba(168, 162, 158, 0)",
    },
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <motion.div
      className="hidden md:block fixed top-0 left-0 z-[9999] pointer-events-none flex items-center justify-center rounded-full overflow-hidden"
      style={{ x: cursorX, y: cursorY }}
      variants={variants}
      animate={cursorType}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
    >
      {/* State-dependent UI: Drag indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: cursorType === 'drag' ? 1 : 0, scale: cursorType === 'drag' ? 0.8 : 0.3 }}
        transition={{ duration: 0.3 }}
        className="text-stone-500 flex items-center justify-center w-full h-full"
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M8 9l-4 3 4 3" />
          <path d="M16 9l4 3-4 3" />
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      </motion.div>
    </motion.div>
  );
}