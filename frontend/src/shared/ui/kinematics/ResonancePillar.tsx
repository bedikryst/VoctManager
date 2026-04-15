/**
 * @file ResonancePillar.tsx
 * @description A kinetically animated, variant-driven acoustic equalizer bar.
 * Uses CVA to strictly type vocal ranges to their respective Ethereal tokens.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/kinematics/ResonancePillar
 */

import React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

// Strict typing for SATB variants. Prevents arbitrary color injections.
export const pillarVariants = cva(
  "w-full rounded-full transition-all duration-700 group-hover:w-[4px] group-hover:-ml-[1px]",
  {
    variants: {
      voice: {
        S: "bg-ethereal-gold shadow-[0_0_16px_rgba(194,168,120,0.6)]",
        A: "bg-ethereal-amethyst shadow-[0_0_16px_rgba(155,138,164,0.6)]",
        T: "bg-ethereal-sage shadow-[0_0_16px_rgba(143,154,138,0.6)]",
        B: "bg-ethereal-incense shadow-[0_0_16px_rgba(166,146,121,0.6)]",
      },
    },
    defaultVariants: {
      voice: "S",
    },
  },
);

interface ResonancePillarProps extends VariantProps<typeof pillarVariants> {
  value: number;
  heightPercentage: string;
  delayIndex: number;
  label: string;
}

export function ResonancePillar({
  value,
  heightPercentage,
  delayIndex,
  label,
  voice,
}: ResonancePillarProps): React.JSX.Element {
  return (
    <div
      className="group relative flex h-full w-12 flex-col items-center justify-end"
      role="listitem"
    >
      <span className="absolute -top-6 text-[11px] font-regular text-ethereal-ink opacity-0 transition-opacity duration-500 group-hover:opacity-100 tabular-nums">
        {value}
      </span>

      <div className="relative flex h-full w-[2px] flex-col justify-end overflow-visible rounded-full bg-ethereal-incense/10">
        <motion.div
          initial={{ height: "0%" }}
          animate={{ height: heightPercentage }}
          transition={{
            duration: 1.8,
            delay: 0.4 + delayIndex * 0.1, // Staggering
            ease: EtherealEasing,
          }}
          className={cn(pillarVariants({ voice }))}
          aria-hidden="true"
        />
      </div>

      <span className="mt-3 text-[12px] font-medium text-ethereal-graphite/60 transition-colors duration-500 group-hover:text-ethereal-ink">
        {label}
      </span>
    </div>
  );
}
