/**
 * @file CustomCursor.tsx
 * @description A high-performance, physics-based custom cursor for the public zone.
 * Restored to full context-awareness whilst mapping hardcoded colours to CSS variables.
 * @module shared/ui/kinematics/CustomCursor
 */

import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring, Variants } from "framer-motion";
import { useCursor } from "@/app/providers/CursorProvider";

export const CustomCursor = (): React.JSX.Element => {
  const { cursorType } = useCursor();

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const springConfig = { damping: 22, stiffness: 200, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, [mouseX, mouseY]);

  // Architectural note: We replace hardcoded 'rgba' strings with Tailwind v4 CSS variables
  // ensuring the Ethereal UI colour palette remains globally cohesive.
  const variants: Variants = {
    default: {
      width: 10,
      height: 10,
      backgroundColor: "var(--color-stone-400)",
      opacity: 0.6,
      x: "-50%",
      y: "-50%",
      backdropFilter: "blur(0px)",
      border: "0px solid transparent",
    },
    drag: {
      width: 30,
      height: 30,
      backgroundColor: "var(--color-stone-400)",
      opacity: 0.2,
      backdropFilter: "blur(4px)",
      border: "1px solid var(--color-stone-400)",
      x: "-50%",
      y: "-50%",
    },
    pointer: {
      width: 0,
      height: 0,
      backgroundColor: "var(--color-stone-400)",
      opacity: 0.6,
      x: "-50%",
      y: "-50%",
      backdropFilter: "blur(0px)",
      border: "0px solid transparent",
    },
  };

  return (
    <motion.div
      className="hidden md:flex fixed top-0 left-0 z-[9999] pointer-events-none items-center justify-center rounded-full overflow-hidden"
      style={{ x: cursorX, y: cursorY }}
      variants={variants}
      animate={cursorType}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      aria-hidden="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{
          opacity: cursorType === "drag" ? 1 : 0,
          scale: cursorType === "drag" ? 0.8 : 0.3,
        }}
        transition={{ duration: 0.3 }}
        className="text-stone-500 flex items-center justify-center w-full h-full"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
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
};
