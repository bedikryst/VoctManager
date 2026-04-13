/**
 * @file motion-presets.ts
 * @description Centralized kinematic constants and variants for Ethereal UI.
 * Enforces strictly typed mathematical consistency across all Framer Motion transitions.
 * @module shared/ui/kinematics/motion-presets
 */

import type { Variants, Transition } from "framer-motion";

// --- Mathematical Curves (Bezier) ---
export const EASE = {
  buttery: [0.16, 1, 0.3, 1] as const, // Ethereal smooth deceleration (Scroll & Reveals)
  spring: [0.76, 0, 0.24, 1] as const, // Cinematic snappy translation (Overlay Menus)
  linear: [0, 0, 1, 1] as const,
} as const;

// --- Time Constants (Seconds) ---
export const DURATION = {
  fast: 0.4,
  base: 0.8,
  slow: 1.2,
} as const;

// --- Shared Transitions ---
export const BASE_TRANSITION: Transition = {
  duration: DURATION.base,
  ease: EASE.buttery,
};

export const SLOW_TRANSITION: Transition = {
  duration: DURATION.slow,
  ease: EASE.buttery,
};

// --- Reusable Variants (Tree-Shakeable) ---
export const FADE_UP_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      ...BASE_TRANSITION,
      delay: delay,
    },
  }),
};

export const MENU_PANEL_VARIANTS: Variants = {
  closed: {
    y: "-100%",
    transition: { duration: DURATION.base, ease: EASE.spring },
  },
  open: {
    y: "0%",
    transition: { duration: DURATION.base, ease: EASE.spring },
  },
};

export const STAGGERED_REVEAL_VARIANTS: Variants = {
  hidden: { y: "120%", rotate: 5, opacity: 0 },
  visible: (i: number) => ({
    y: "0%",
    rotate: 0,
    opacity: 1,
    transition: {
      duration: DURATION.base,
      delay: 0.3 + i * 0.08,
      ease: EASE.buttery,
    },
  }),
};
