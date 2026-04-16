/**
 * @file MobileNavTrigger.tsx
 * @description Closed state of the mobile navigation. Acts as a fluid "Dynamic Island" pill.
 * Engineered for React 19 Compiler. Validated DOM nesting (no button-in-button).
 */

import React from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Label, Text } from "@/shared/ui/primitives/typography";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { useNavigationAura } from "../hooks/useNavigationAura";

interface MobileNavTriggerProps {
  readonly onOpen: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

const BrandMark = () => (
  <motion.div layout="position" className="flex items-center">
    <Heading
      as="span"
      size="md"
      className="tracking-tight select-none pt-0.5 flex items-center"
    >
      <span className="font-medium text-ethereal-ink">Voct</span>
      <Text
        as="span"
        weight="normal"
        color="gold"
        size="xl"
        className="italic ml-[0.5px] pb-[2.5px]"
      >
        Manager
      </Text>
    </Heading>
  </motion.div>
);

export const MobileNavTrigger = ({
  onOpen,
  aura,
}: MobileNavTriggerProps): React.JSX.Element => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed bottom-6 left-0 right-0 z-[70] flex justify-center px-4 pointer-events-none"
    >
      <GlassCard
        variant="ethereal"
        padding="none"
        withNoise={true}
        className="pointer-events-auto flex items-center justify-between h-[64px] px-2 rounded-full min-w-[280px] max-w-sm w-full border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transform-gpu"
      >
        <button
          onClick={onOpen}
          aria-label="Open navigation menu"
          className="flex flex-1 items-center gap-3 h-full rounded-l-full outline-none active:scale-95 transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold"
        >
          <div className="flex shrink-0 h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-ethereal-gold/15 to-transparent border border-ethereal-gold/20">
            <Label
              as="span"
              color="gold"
              weight="bold"
              className="tracking-widest text-sm"
            >
              {aura.initials}
            </Label>
          </div>

          <div className="flex items-center justify-center gap-2 pr-2">
            <Menu className="text-ethereal-graphite/70" size={18} />
            <BrandMark />
          </div>
        </button>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center relative z-10">
          <NotificationCenter />
        </div>
      </GlassCard>
    </motion.div>
  );
};
