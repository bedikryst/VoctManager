/**
 * @file GlassCard.tsx
 * @description High-end structural container providing layered glassmorphism.
 * Enhanced with Framer Motion for Kinematic Spotlight Tracking.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/GlassCard
 */

import React, { forwardRef, MouseEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  "group relative overflow-hidden rounded-[2.5rem] transition-all duration-500 ease-out z-0",
  {
    variants: {
      variant: {
        ethereal:
          "bg-white/45 backdrop-blur-[16px] border border-white/80 shadow-glass-ethereal",
        solid:
          "bg-ethereal-marble/95 border border-ethereal-incense/15 shadow-glass-solid",
        dark: "bg-ethereal-ink backdrop-blur-3xl border border-ethereal-incense/20 text-ethereal-marble shadow-2xl",
        outline:
          "bg-transparent border border-ethereal-incense/30 hover:border-ethereal-gold hover:shadow-glass-outline-hover",
      },
      isHoverable: {
        true: "hover:-translate-y-1.5 hover:scale-[1.01] cursor-pointer hover:shadow-glass-ethereal-hover",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6 md:p-8",
        lg: "p-8 md:p-12",
      },
    },
    defaultVariants: {
      variant: "ethereal",
      padding: "md",
      isHoverable: false,
    },
  },
);

export interface GlassCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  /** Renders a subtle noise texture overlay for an organic feel */
  withNoise?: boolean;
  /** Enables the kinematic spotlight effect tracking the cursor */
  glow?: boolean;
  /** Custom background element (e.g., an abstract gradient or image) */
  backgroundElement?: React.ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant,
      padding,
      glow = false,
      isHoverable,
      withNoise = false,
      backgroundElement,
      className,
      onMouseMove,
      ...props
    },
    ref,
  ) => {
    // Kinematic values for the spotlight effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
      // Execute external onMouseMove if provided
      if (onMouseMove) onMouseMove(event);

      if (!glow) return;

      const { left, top } = event.currentTarget.getBoundingClientRect();
      mouseX.set(event.clientX - left);
      mouseY.set(event.clientY - top);
    };

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        className={cn(
          glassCardVariants({
            variant,
            padding,
            isHoverable,
            className,
          }),
        )}
        {...props}
      >
        {/* KINEMATIC SPOTLIGHT LAYER */}
        {glow && (
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100 z-[-1]"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  600px circle at ${mouseX}px ${mouseY}px,
                  rgba(194, 168, 120, 0.12),
                  transparent 80%
                )
              `,
            }}
            aria-hidden="true"
          />
        )}

        {/* CUSTOM BACKGROUND LAYER */}
        {backgroundElement && (
          <div
            className="absolute inset-0 -z-20 overflow-hidden"
            aria-hidden="true"
          >
            {backgroundElement}
          </div>
        )}

        {/* ORGANIC NOISE TEXTURE */}
        {withNoise && (
          <div
            className="bg-noise absolute inset-0 -z-10 opacity-[0.03] pointer-events-none mix-blend-overlay"
            aria-hidden="true"
          />
        )}

        {/* CONTENT PAYLOAD */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
