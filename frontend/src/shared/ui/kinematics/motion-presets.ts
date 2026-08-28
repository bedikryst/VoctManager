/**
 * @file motion-presets.ts
 * @description Centralized kinematic constants and variants for Ethereal UI.
 * Enforces strictly typed mathematical consistency across all Framer Motion transitions.
 * @module shared/ui/kinematics/motion-presets
 */

import type { Variants } from "framer-motion";

// --- Mathematical Curves (Bezier) ---
export const EASE = {
  buttery: [0.16, 1, 0.3, 1] as const, // Ethereal smooth deceleration (Scroll & Reveals)
} as const;

/**
 * THE INK REGISTER — the entrance law the marketing site is built on
 * (`web/src/styles/tokens.css`, `registers.css`), transposed to the panel.
 *
 * Two rules, and both are as much a paint budget as a taste:
 *  1. NOTHING ENTERS FROM `opacity: 0`. A surface waits at `half` and is inked to
 *     full. The site's reason is that a hole which then fills itself in is what
 *     reads as generated; the panel's reason is the same reading plus a harder
 *     one — a dashboard whose text is invisible for the first second is a
 *     dashboard you cannot use for a second.
 *  2. NOTHING TRAVELS. An entrance built from `y` / `scale` promotes every
 *     participant to its own composited layer for the length of the animation.
 *     Opacity alone on an already-painted element is the cheapest arrival there
 *     is, and on a bento grid that is 6–9 layers not created.
 *
 * `half` is the site's `--half-ink` verbatim, so the two surfaces half-light at
 * one strength. `in` is NOT: the site spends 0.9s because its register arrives
 * under a scroll, and the panel's arrives under a tap — the same reasoning that
 * gives the site's own nave menu a local 0.36s.
 *
 * THE LAW HAS A PRECONDITION: one ramp per surface. Two nested ink ramps
 * MULTIPLY (0.44² ≈ 0.19, 0.44³ ≈ 0.09), which is the hole again, only harder to
 * find. The panel's chain was collapsed to satisfy it: `PageTransition` is the
 * single route-level ramp, the shell above it only remounts on its route key,
 * and `DashboardHome` between them animates nothing. Before putting this
 * register on a new surface, check what already fades above it — and if you are
 * reaching for a fade at route level, you are reaching for the one that exists.
 */
export const INK = {
  half: 0.44,
  in: 0.42,
  /** `--ease-ink`: a genuine ease-out — the material floods, then settles. */
  ease: [0.34, 0.62, 0.28, 1] as const,
} as const;

/**
 * The panel's one shared duration (seconds), and it is a DISCLOSURE budget:
 * settings sections opening, a strength meter growing, a save footer arriving —
 * places where the reveal is itself the content and the eye follows it out.
 *
 * It is not a general baseline, and there is deliberately nothing longer here.
 * A route entrance is `INK.in` above. Anything smaller than a disclosure is a
 * micro-interaction, belongs to the component that owns it, and belongs inside
 * the 0.2–0.3 s perceptual budget for UI motion — which every rung past this
 * one would have sat outside of.
 */
export const DURATION = {
  fast: 0.4,
} as const;

/**
 * The container orchestrates and NOTHING ELSE — deliberately no opacity of its
 * own. It used to fade 0 → 1 while every child ran its own ramp inside it, so
 * for the length of the overlap the two alphas multiplied and no tile on the
 * grid had a clean start state. Framer propagates the stagger from a variant
 * that animates nothing at all, so orchestration costs no second ramp.
 */
export const BENTO_CONTAINER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      // Kept at a wash rather than raised to a counted sequence (~0.12s is where
      // adjacent onsets stop fusing into one event). A bento grid is a FIELD, not
      // an index: its tiles are read as one surface, and stretching nine of them
      // into a countable ladder is a second of staggering bought for nothing.
      staggerChildren: 0.05,
    },
  },
};

/** One tile, arriving under the ink law: half-ink to full, and it does not move. */
export const BENTO_ITEM_VARIANTS: Variants = {
  hidden: { opacity: INK.half },
  visible: {
    opacity: 1,
    transition: {
      duration: INK.in,
      ease: INK.ease,
    },
  },
};
