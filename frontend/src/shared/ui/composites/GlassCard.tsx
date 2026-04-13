/**
 * @file GlassCard.tsx
 * @description High-end structural container providing layered glassmorphism.
 * Enhanced with Framer Motion for precise Kinematic Spotlight Tracking and Deep Refraction.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/GlassCard
 */

import React, { forwardRef, MouseEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  "group relative overflow-hidden rounded-[2.5rem] transition-all duration-700 ease-out",
  {
    variants: {
      variant: {
        ethereal:
          "bg-white/10 backdrop-blur-[24px] border border-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_8px_32px_rgba(166,146,121,0.12)]",
        solid:
          "bg-ethereal-marble/95 border border-ethereal-incense/15 shadow-glass-solid",
        dark: "bg-ethereal-ink/80 backdrop-blur-[32px] border border-ethereal-incense/20 text-ethereal-marble shadow-2xl",
        outline:
          "bg-transparent border border-ethereal-incense/30 hover:border-ethereal-gold hover:shadow-[0_4px_24px_rgba(194,168,120,0.15)]",
      },
      isHoverable: {
        true: "hover:-translate-y-1.5 hover:scale-[1.005] cursor-pointer hover:shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_16px_48px_rgba(166,146,121,0.18)] hover:bg-white/20",
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
      isHoverable: true,
    },
  },
);

export interface GlassCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  withNoise?: boolean;
  glow?: boolean;
  backgroundElement?: React.ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant,
      padding,
      glow = true,
      isHoverable,
      withNoise = false,
      backgroundElement,
      className,
      onMouseMove,
      ...props
    },
    ref,
  ) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
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
        {/* KINEMATIC SPOTLIGHT LAYER - Focal length precisely calibrated */}
        {glow && (
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100 z-0"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  300px circle at ${mouseX}px ${mouseY}px,
                  rgba(255, 255, 255, 0.40),
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
            className="absolute inset-0 -z-20 overflow-hidden mix-blend-overlay"
            aria-hidden="true"
          >
            {backgroundElement}
          </div>
        )}

        {/* ORGANIC NOISE TEXTURE */}
        {withNoise && (
          <div
            className="absolute inset-0 -z-10 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.04%22/%3E%3C/svg%3E')] pointer-events-none mix-blend-color-burn"
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
