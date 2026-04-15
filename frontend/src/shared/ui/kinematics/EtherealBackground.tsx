/**
 * @file EtherealBackground.tsx
 * @description Persistent ambient layer with Oculus Vignette and Kinematic Stave.
 * Implements "Compositor Freezing" to release GPU memory post-animation.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/kinematics/EtherealBackground
 */

import React from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/app/store/useAppStore";

export const EtherealBackground = React.memo((): React.JSX.Element => {
  const isAuraStabilized = useAppStore((state) => state.isAuraStabilized);
  const stabilizeAura = useAppStore((state) => state.stabilizeAura);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ethereal-alabaster"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        // Hardware acceleration barrier. Release when stabilized.
        style={{
          transform: "translateZ(0)",
          willChange: isAuraStabilized ? "auto" : "transform",
        }}
      >
        {/* LAYER 0: The Oculus Vignette (Chiaroscuro Base) */}
        <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,transparent_10%,rgba(22,20,18,0.06)_100%)]" />

        {/* LAYER 1: Core Ethereal Glows (Sub-pixel rendering) */}
        <div className="absolute -left-[5%] -top-[5%] z-[2] h-[45vw] w-[45vw] rounded-full bg-ethereal-gold/20 blur-[100px] mix-blend-multiply" />
        <div className="absolute -bottom-[50%] -right-[10%] z-[2] h-[55vw] w-[55vw] rounded-full bg-ethereal-amethyst/15 blur-[100px] mix-blend-multiply" />

        {/* LAYER 2: The Kinematic Stave */}
        <div className="absolute inset-0 z-[3] flex items-center justify-center">
          <motion.div
            className="flex h-[300vh] w-[300vw] -rotate-[8deg] flex-col justify-center"
            // If already stabilized (e.g., page refresh or navigation), skip to "visible" instantly
            initial={isAuraStabilized ? "visible" : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.15 } },
            }}
            // Trigger Zustand to freeze GPU usage after the 8s + staggering delay
            onAnimationComplete={() => {
              if (!isAuraStabilized) stabilizeAura();
            }}
          >
            {[1, 2, 3, 4, 5].map((_, index) => (
              <motion.div
                key={`stave-line-${index}`}
                className="mb-[50px] h-[1px] w-full bg-gradient-to-r from-transparent via-ethereal-incense/80 to-transparent shadow-[0_0_8px_rgba(194,168,120,0.35)] last:mb-0"
                // FREEZE THE COMPOSITOR: Switch from rendering properties to auto when done
                style={{
                  willChange: isAuraStabilized ? "auto" : "width, opacity",
                }}
                variants={{
                  hidden: { width: "0%", opacity: 0 },
                  visible: {
                    width: "100%",
                    opacity: 1,
                    transition: { duration: 8, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              />
            ))}
          </motion.div>
        </div>

        {/* LAYER 3: Micro-noise (Film Grain) */}
        <div className="absolute inset-0 z-[4] bg-noise opacity-[0.025] mix-blend-overlay" />
      </div>
    </div>
  );
});

EtherealBackground.displayName = "EtherealBackground";
