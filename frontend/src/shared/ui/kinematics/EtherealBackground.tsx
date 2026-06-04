/**
 * @file EtherealBackground.tsx
 * @description Persistent ambient layer — "Nawa światła" (Nave of Light).
 * A calm sacred-interior field: warm light entering from above, soft
 * incense-light glows, a diagonal musical stave laid across the whole viewport,
 * a faint historical C-clef signature and a chiaroscuro vignette. The stave and
 * clef play a single, slow draw-in on first entry, gated by `isAuraStabilized`
 * so every later navigation (and the login → panel hand-off) skips straight to
 * the settled state until a full reload. The glows breathe via a GPU-only CSS
 * keyframe. A quiet stage for the content, never a competitor for it.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/kinematics/EtherealBackground
 */

import React from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/app/store/useAppStore";
import { VocalClefShadow } from "@/shared/ui/kinematics/VocalClefShadow";

export const EtherealBackground = React.memo((): React.JSX.Element => {
  const isAuraStabilized = useAppStore((state) => state.isAuraStabilized);
  const stabilizeAura = useAppStore((state) => state.stabilizeAura);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ethereal-canvas"
      aria-hidden="true"
    >
      {/* LAYER 1 — Light from above: a warm wash entering at the top, like
          daylight falling into a nave. Fades out before the content zone. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(253,253,250,0.55)_0%,rgba(253,253,250,0)_44%)]" />

      {/* LAYER 2 — Warm chiaroscuro glows. Multiply over the deeper canvas reads
          as soft incense-light pooling; `ethereal-breath` gives slow GPU-only
          life. Positioned to warm the top-left and the otherwise-empty lower-right. */}
      <div className="ethereal-breath absolute -left-[6%] -top-[8%] h-[42vw] w-[42vw] rounded-full bg-ethereal-gold/20 mix-blend-multiply blur-[110px] [--breath-delay:0s] [--breath-duration:11s] [--breath-max:0.26] [--breath-min:0.14] [--breath-scale:1.15]" />
      <div className="ethereal-breath absolute -bottom-[20%] -right-[6%] h-[48vw] w-[48vw] rounded-full bg-ethereal-amethyst/15 mix-blend-multiply blur-[120px] [--breath-delay:1.5s] [--breath-duration:13s] [--breath-max:0.2] [--breath-min:0.1] [--breath-scale:1.2]" />

      {/* LAYER 3 — The kinematic stave: a diagonal musical staff laid across the
          field, oversized so it spans the whole viewport. Plays a slow,
          staggered scaleX draw-in once per session (gated by isAuraStabilized);
          scaleX is GPU-composited and willChange is released to `auto` once
          stabilised so the compositor stops reserving a layer after the intro. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative flex h-[300vh] w-[300vw] -rotate-[8deg] flex-col justify-center"
          initial={isAuraStabilized ? "visible" : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
          onAnimationComplete={() => {
            if (!isAuraStabilized) stabilizeAura();
          }}
        >
          {[0, 1, 2, 3, 4].map((line) => (
            <motion.div
              key={`stave-line-${line}`}
              className="mb-16 h-px w-full origin-left bg-linear-to-r from-transparent via-ethereal-incense/55 to-transparent shadow-[0_0_8px_rgba(194,168,120,0.35)] last:mb-0"
              style={{
                willChange: isAuraStabilized ? "auto" : "transform, opacity",
              }}
              variants={{
                hidden: { scaleX: 0, opacity: 0 },
                visible: {
                  scaleX: 1,
                  opacity: 1,
                  transition: { duration: 10, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* LAYER 4 — The historical C-clef signature, lifted to viewport level so
          it actually reads on-screen (a touch warmer/brighter than its faint
          default). Fades in once alongside the stave, then settles. */}
      <motion.div
        className="absolute inset-0"
        initial={isAuraStabilized ? "visible" : "hidden"}
        animate="visible"
      >
        <VocalClefShadow className="left-[3%] text-ethereal-incense/15" />
      </motion.div>

      {/* LAYER 5 — Oculus vignette: subtle darkening toward the edges for the
          chiaroscuro of a sacred interior. Keeps the eye on the lit centre. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,transparent_44%,rgba(22,20,18,0.05)_100%)]" />

      {/* LAYER 6 — Film grain for atmosphere and to break up gradient banding. */}
      <div className="absolute inset-0 bg-noise opacity-[0.02] mix-blend-overlay" />
    </div>
  );
});

EtherealBackground.displayName = "EtherealBackground";
