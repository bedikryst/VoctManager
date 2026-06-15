/**
 * @file AuthBrand.tsx
 * @description The VoctManager wordmark crown shared by the auth threshold
 * screens. On entry a single warm "struck pitch" halo rings out behind the
 * mark — a quiet nod to a tuning fork settling to A before the choir sings —
 * then the field goes still. Tone adapts to light (card) or dark (nave) ground.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthBrand
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { Heading } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";

interface AuthBrandProps {
  /** Optional supporting line rendered beneath the wordmark. */
  readonly tagline?: string;
  /** "ink" for light card grounds, "marble" for the dark nave rail. */
  readonly tone?: "ink" | "marble";
  readonly align?: "center" | "left";
  readonly size?: "lg" | "xl";
  readonly className?: string;
}

export const AuthBrand = ({
  tagline,
  tone = "ink",
  align = "center",
  size = "xl",
  className,
}: AuthBrandProps): React.JSX.Element => {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative inline-flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {/* The wordmark, with a one-shot "struck pitch" halo pooled behind it —
          centred on the mark itself (not the whole stack) so it reads as a
          glow under the type rather than a smudge below it. */}
      <span className="relative inline-flex w-fit">
        {!reduceMotion && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0.45, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.7 }}
            transition={{ duration: 1.6, ease: EASE.buttery, delay: 0.15 }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ethereal-gold/40 blur-2xl"
          />
        )}

        <Heading
          as="span"
          size={size === "xl" ? "huge" : "5xl"}
          weight="medium"
          className={cn(
            "relative leading-none",
            tone === "ink" ? "text-ethereal-ink" : "text-ethereal-marble",
          )}
        >
          Voct
          <span className="italic text-ethereal-gold">Manager</span>
        </Heading>
      </span>

      {tagline && (
        <span
          className={cn(
            "relative mt-3 text-[10px] font-bold uppercase tracking-[0.28em]",
            tone === "ink"
              ? "text-ethereal-graphite/55"
              : "text-ethereal-parchment/55",
          )}
        >
          {tagline}
        </span>
      )}
    </div>
  );
};
