/**
 * @file ArtistEmptyState.tsx
 * @description Zen-state "Empty State" component for the Artist Dashboard.
 * Displays a breathing resonance animation (graphic score concept) when no events are scheduled.
 * Zero Tech-Debt. Strict TS 7.0. Ethereal UI Design Language.
 * @module features/dashboard/components/ArtistEmptyState
 */

import React, { type CSSProperties } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Feather } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text } from "@/shared/ui/primitives/typography";

type BreathRing = {
  size: number;
  borderClass: string;
  duration: string;
  delay: string;
  scale: string;
  min: string;
  max: string;
};

const RESONANCE_RINGS: ReadonlyArray<BreathRing> = [
  { size: 280, borderClass: "border-ethereal-gold/30", duration: "8s", delay: "0s", scale: "1.4", min: "0.10", max: "0.30" },
  { size: 380, borderClass: "border-ethereal-sage/20", duration: "12s", delay: "2s", scale: "1.7", min: "0.05", max: "0.15" },
  { size: 500, borderClass: "border-ethereal-incense/10", duration: "16s", delay: "4s", scale: "1.2", min: "0.02", max: "0.08" },
];

const ResonanceWaves = (): React.JSX.Element => (
  <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none mix-blend-multiply">
    {RESONANCE_RINGS.map((ring) => {
      const style: CSSProperties & Record<string, string> = {
        width: `${ring.size}px`,
        height: `${ring.size}px`,
        "--breath-duration": ring.duration,
        "--breath-delay": ring.delay,
        "--breath-scale": ring.scale,
        "--breath-min": ring.min,
        "--breath-max": ring.max,
      };
      return (
        <div
          key={ring.size}
          aria-hidden="true"
          style={style}
          className={`ethereal-breath absolute rounded-full border ${ring.borderClass}`}
        />
      );
    })}
  </div>
);

export const ArtistEmptyState = (): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        variant="light"
        padding="lg"
        isHoverable={false}
        className="group flex flex-col items-center justify-center py-24 text-center"
        backgroundElement={<ResonanceWaves />}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="p-5 rounded-full bg-ethereal-marble/40 border border-white/60 shadow-glass-ethereal mb-6 transition-transform duration-700 group-hover:-translate-y-2 group-hover:scale-105">
            <Feather
              size={32}
              className="text-ethereal-gold/70 stroke-[1.2px]"
              aria-hidden="true"
            />
          </div>

          <Heading as="h3" size="2xl" weight="medium" className="mb-2">
            {t(
              "dashboard.artist.empty_events_title",
              "Brak nadchodzących wydarzeń",
            )}
          </Heading>

          <Text color="graphite" size="sm" className="max-w-md leading-relaxed">
            {t(
              "dashboard.artist.empty_events_desc",
              "Odpocznij. Twój muzyczny kalendarz jest obecnie pusty. Czas na regenerację głosu.",
            )}
          </Text>
        </motion.div>
      </GlassCard>
    </motion.div>
  );
};
