/**
 * @file NaveScene.tsx
 * @description The nave in full light: the scenography of the panel's
 * full-screen first-run moments (the welcome, the vocal-range prompt). The
 * dashboard's ambient EtherealBackground sits *under* such an (opaque)
 * overlay, so the scene is restated here at ceremonial intensity: the same
 * layers, brighter, closer. Paint it in a non-scrolling wrapper, so a short
 * viewport scrolls the words, never the light.
 *
 * A moment that takes over from another (the welcome handing to the vocal-range
 * prompt) passes `lit`: the scene is already on screen under it, so it starts
 * fully drawn, and redrawing the stave would read as a cut.
 * @module shared/ui/kinematics/NaveScene
 */

import React from "react";
import { motion } from "framer-motion";

import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { VocalClefShadow } from "@/shared/ui/kinematics/VocalClefShadow";

const STAVE_LINES = [0, 1, 2, 3, 4] as const;

export interface NaveSceneProps {
  /** Whether a tone is sounding: the shaft of light answers it. */
  readonly isToneRinging: boolean;
  readonly reduceMotion: boolean;
  /** Start fully drawn, with no entrance: the scene is already showing. */
  readonly lit?: boolean;
}

export const NaveScene = ({
  isToneRinging,
  reduceMotion,
  lit = false,
}: NaveSceneProps): React.JSX.Element => {
  const still = reduceMotion || lit;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Base — light falls from above: marble at the clerestory, parchment at
          the floor. Fully opaque: the reveal of the dashboard is the overlay's
          exit fade, not a haze over it. */}
      <div className="absolute inset-0 bg-linear-to-b from-ethereal-marble via-ethereal-alabaster to-ethereal-parchment" />

      {/* Shaft of light — a warm beam entering at the top centre, light at its
          core with a golden fringe. It swells while a tone rings. The core is
          `--aura-shaft` because a beam is a fraction of itself on a dark ground;
          the fringe stays a gold literal, because an accent holds. */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_-12%,var(--aura-shaft)_0%,rgba(194,168,120,0.14)_46%,transparent_72%)]"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: isToneRinging ? 1 : 0.7 }}
        transition={{ duration: 1.4, ease: EASE.buttery }}
      />

      {/* Incense-light glows — gold pooling top-left, amethyst lower-right,
          the EtherealBackground pair a shade warmer for the ceremony. */}
      <div className="absolute -left-[8%] -top-[10%] h-[46vw] w-[46vw] rounded-full bg-ethereal-gold/25 opacity-30 mix-blend-multiply blur-[110px] light-ground-film" />
      <div className="absolute -bottom-[22%] -right-[8%] h-[50vw] w-[50vw] rounded-full bg-ethereal-amethyst/20 opacity-20 mix-blend-multiply blur-[120px] light-ground-film" />

      {/* The stave — the score the singer steps into, drawing itself in once. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="flex w-[170vw] shrink-0 -rotate-[8deg] flex-col gap-14"
          initial={still ? "visible" : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
        >
          {STAVE_LINES.map((line) => (
            <motion.div
              key={`nave-stave-${line}`}
              className="h-px w-full origin-left bg-linear-to-r from-transparent via-ethereal-incense/45 to-transparent shadow-[0_0_8px_rgba(194,168,120,0.35)]"
              variants={{
                hidden: { scaleX: 0, opacity: 0 },
                visible: {
                  scaleX: 1,
                  opacity: 1,
                  transition: { duration: 2.4, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* The C-clef signature, settled at the singer's left hand. */}
      <motion.div
        className="absolute inset-0"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.4, ease: EASE.buttery }}
      >
        <VocalClefShadow className="left-[4%] text-ethereal-incense/25" />
      </motion.div>

      {/* Oculus vignette + film grain — the chiaroscuro of a lit interior,
          grain held at the app-wide whisper (NOT a dirty film over the scene). */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,transparent_40%,var(--aura-vignette)_100%)]" />
      <div className="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay" />
    </div>
  );
};
