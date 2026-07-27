/**
 * @file ResonancePillar.tsx
 * @description One column of the ensemble-balance equaliser: a hairline track,
 * a bar that grows into it on mount, its figure and its label.
 *
 * Colour comes from the caller's taxonomy through `accents.ts`, never from a
 * table here. This file used to type its own — S gold, A amethyst, T sage, B
 * incense — while `voiceSections.ts` had settled on S incense, A amethyst, T
 * gold, B sage, so three of the four voices were one colour on the manager's
 * dashboard and a different one on the roster two clicks away. Nobody chose
 * that; two private copies of one table did.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/kinematics/ResonancePillar
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { ACCENT_BAR, type EtherealAccent } from "@/shared/ui/primitives/accents";
import { Caption, Text } from "@/shared/ui/primitives/typography";

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

interface ResonancePillarProps {
  value: number;
  heightPercentage: string;
  delayIndex: number;
  label: string;
  /** The accent this category claims — see `accents.ts`. */
  accent: EtherealAccent;
}

export function ResonancePillar({
  value,
  heightPercentage,
  delayIndex,
  label,
  accent,
}: ResonancePillarProps): React.JSX.Element {
  return (
    <div
      className="group relative flex h-full w-12 flex-col items-center justify-end"
      role="listitem"
    >
      {/* The figure stays visible. It was `opacity-0 group-hover:opacity-100`,
          which on a phone meant the chart had no numbers at all. */}
      <Text
        as="span"
        size="xs"
        color="graphite"
        className="absolute -top-6 tabular-nums"
      >
        {value}
      </Text>

      <div className="relative flex h-full w-0.5 flex-col justify-end overflow-visible rounded-full bg-hairline">
        <motion.div
          initial={{ height: "0%" }}
          animate={{ height: heightPercentage }}
          transition={{
            duration: 1.8,
            delay: 0.4 + delayIndex * 0.1, // Staggering
            ease: EtherealEasing,
          }}
          className={cn(
            "w-full rounded-full transition-[width,margin] duration-700 group-hover:-ml-px group-hover:w-1",
            ACCENT_BAR[accent],
          )}
          aria-hidden="true"
        />
      </div>

      <Caption className="mt-3 transition-colors duration-500 group-hover:text-ethereal-ink">
        {label}
      </Caption>
    </div>
  );
}
