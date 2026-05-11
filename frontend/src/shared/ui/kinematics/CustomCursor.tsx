/**
 * @file CustomCursor.tsx
 * @description Editorial cursor for the public VoctEnsemble experience.
 * @module shared/ui/kinematics/CustomCursor
 */

import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, Variants } from "framer-motion";
import { useCursor } from "@/app/providers/CursorProvider";

const springConfig = { damping: 26, stiffness: 260, mass: 0.42 };

export const CustomCursor = (): React.JSX.Element | null => {
  const { cursorType } = useCursor();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [autoPointer, setAutoPointer] = useState<boolean>(false);

  const mouseX = useMotionValue(-120);
  const mouseY = useMotionValue(-120);
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const media = window.matchMedia("(pointer: fine) and (hover: hover)");
    const sync = () => setEnabled(media.matches);

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const previousHtmlCursor = document.documentElement.style.cursor;
    const previousBodyCursor = document.body.style.cursor;
    const style = document.createElement("style");
    style.dataset.voctCursor = "true";
    style.textContent = `
      @media (pointer: fine) and (hover: hover) {
        .theme-marketing, .theme-marketing * { cursor: none !important; }
      }
    `;

    document.head.appendChild(style);
    document.documentElement.style.cursor = "none";
    document.body.style.cursor = "none";

    return () => {
      document.documentElement.style.cursor = previousHtmlCursor;
      document.body.style.cursor = previousBodyCursor;
      style.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const moveCursor = (event: MouseEvent) => {
      mouseX.set(event.clientX);
      mouseY.set(event.clientY);

      const target = event.target;
      const interactive =
        target instanceof Element &&
        Boolean(
          target.closest(
            'a, button, input, textarea, select, summary, [role="button"], [role="link"], [data-cursor="pointer"]',
          ),
        );
      setAutoPointer(interactive);
    };

    window.addEventListener("mousemove", moveCursor, { passive: true });
    return () => window.removeEventListener("mousemove", moveCursor);
  }, [enabled, mouseX, mouseY]);

  if (!enabled) return null;

  const visualCursorType =
    cursorType === "default" && autoPointer ? "pointer" : cursorType;

  const shellVariants: Variants = {
    default: {
      width: 34,
      height: 34,
      borderColor: "rgba(244, 241, 233, 0.58)",
      backgroundColor: "rgba(198, 164, 91, 0.08)",
      opacity: 0.78,
    },
    pointer: {
      width: 58,
      height: 58,
      borderColor: "rgba(226, 205, 149, 0.84)",
      backgroundColor: "rgba(244, 241, 233, 0.06)",
      opacity: 0.95,
    },
    drag: {
      width: 82,
      height: 42,
      borderColor: "rgba(226, 205, 149, 0.86)",
      backgroundColor: "rgba(8, 8, 7, 0.2)",
      opacity: 0.95,
    },
  };

  const dotVariants: Variants = {
    default: {
      scale: 1,
      opacity: 0.95,
      backgroundColor: "rgba(226, 205, 149, 0.88)",
    },
    pointer: {
      scale: 0.36,
      opacity: 0.7,
      backgroundColor: "rgba(244, 241, 233, 0.92)",
    },
    drag: {
      scale: 0,
      opacity: 0,
    },
  };

  return (
    <motion.div
      className="fixed left-0 top-0 z-[9999] pointer-events-none hidden md:block"
      style={{ x: cursorX, y: cursorY }}
      aria-hidden="true"
    >
      <motion.div
        className="relative flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border mix-blend-difference"
        variants={shellVariants}
        animate={visualCursorType}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.16, 1] }}
      >
        <motion.span
          className="block h-[5px] w-[5px] rounded-full"
          variants={dotVariants}
          animate={visualCursorType}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.16, 1] }}
        />

        <motion.svg
          className="absolute text-[#e2cd95]"
          width="42"
          height="16"
          viewBox="0 0 42 16"
          fill="none"
          initial={false}
          animate={{
            opacity: visualCursorType === "drag" ? 1 : 0,
            scaleX: visualCursorType === "drag" ? 1 : 0.72,
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <path d="M12 4L5 8L12 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 4L37 8L30 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 8H36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </motion.svg>
      </motion.div>
    </motion.div>
  );
};
