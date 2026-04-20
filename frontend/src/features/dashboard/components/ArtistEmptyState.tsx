/**
 * @file ArtistEmptyState.tsx
 * @description Zen-state "Empty State" component for the Artist Dashboard.
 * Displays a breathing resonance animation (graphic score concept) when no events are scheduled.
 * Zero Tech-Debt. Strict TS 7.0. Ethereal UI Design Language.
 * @module features/dashboard/components/ArtistEmptyState
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Feather } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text } from "@/shared/ui/primitives/typography";

/**
 * Background element creating an organic, breathing sound-wave effect.
 */
const ResonanceWaves = (): React.JSX.Element => (
  <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none mix-blend-multiply">
    <motion.div
      animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      className="absolute w-[280px] h-[280px] rounded-full border border-ethereal-gold/30"
    />
    <motion.div
      animate={{ scale: [1, 1.7, 1], opacity: [0.05, 0.15, 0.05] }}
      transition={{
        duration: 12,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 2,
      }}
      className="absolute w-[380px] h-[380px] rounded-full border border-ethereal-sage/20"
    />
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.02, 0.08, 0.02] }}
      transition={{
        duration: 16,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 4,
      }}
      className="absolute w-[500px] h-[500px] rounded-full border border-ethereal-incense/10"
    />
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
        glow={true}
        isHoverable={true}
        className="group flex flex-col items-center justify-center py-24 text-center overflow-hidden"
        backgroundElement={<ResonanceWaves />}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Ikonografia: Pióro (Feather) zamiast medycznego Activity, symbolizujące lekkość i ciszę */}
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
              "Odpocznij. Twój muzyczny kalendarz jest obecnie pusty, a aura została w pełni zharmonizowana. Czas na regenerację głosu.",
            )}
          </Text>
        </motion.div>
      </GlassCard>
    </motion.div>
  );
};
