/**
 * @file VocalClefShadow.tsx
 * @description A highly subtle, historically accurate C-Clef (Alto/Tenor clef).
 * Crafted with calligraphic precision for the Ethereal UI design language.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/kinematics/VocalClefShadow
 */

import React from "react";
import { motion } from "framer-motion";

export const VocalClefShadow = React.memo(
  (): React.JSX.Element => (
    <motion.div
      className="absolute left-[1%] top-1/2 z-[1] -translate-y-1/2 text-ethereal-ink/5 mix-blend-overlay"
      // Hardware acceleration applied exclusively during the animation phase
      variants={{
        hidden: { opacity: 0, scale: 0.95, filter: "blur(8px)" },
        visible: {
          opacity: 1,
          scale: 1.2,
          filter: "blur(5px)",
          transition: { duration: 10, ease: [0.16, 1, 0.3, 1], delay: 0 },
        },
      }}
    >
      <svg
        width="180"
        height="240"
        viewBox="0 0 100 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="drop-shadow-[0_0_12px_rgba(194,168,120,0.15)]"
      >
        {/* A stylised, historically resonant C-Clef. 
        Path 1: The Left Pillar (Virga) - solid and grounded 
      */}
        <path
          d="M 18 25 C 18 23 20 20 24 20 C 28 20 30 23 30 25 V 125 C 30 127 28 130 24 130 C 20 130 18 127 18 125 Z"
          fill="currentColor"
        />

        {/* Path 2: The Inner Pillar - delicate and precise */}
        <path
          d="M 38 25 C 38 24 39 23 40 23 C 41 23 42 24 42 25 V 125 C 42 126 41 127 40 127 C 39 127 38 126 38 125 Z"
          fill="currentColor"
        />

        {/* Path 3: The Upper Lobe - sweeping and elegant */}
        <path
          d="M 42 60 C 50 62 60 62 70 55 C 78 49 80 40 75 33 C 69 25 55 25 42 30 V 45 C 50 40 60 40 65 45 C 68 48 65 52 55 54 L 42 55 Z"
          fill="currentColor"
        />

        {/* Path 4: The Lower Lobe - anchoring the lower register */}
        <path
          d="M 42 90 C 50 88 60 88 70 95 C 78 101 80 110 75 117 C 69 125 55 125 42 120 V 105 C 50 110 60 110 65 105 C 68 102 65 98 55 96 L 42 95 Z"
          fill="currentColor"
        />

        {/* Path 5: The Pointer - sharply indicating the C line */}
        <path d="M 42 68 L 55 75 L 42 82 Z" fill="currentColor" />
      </svg>
    </motion.div>
  ),
);

VocalClefShadow.displayName = "VocalClefShadow";
