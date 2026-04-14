/**
 * @file GlassCard.tsx
 * @description High-end structural container providing layered glassmorphism.
 * Refactored for 'Chiaroscuro' light dynamics and 'Lead Came' micro-borders.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/GlassCard
 */

import React, { forwardRef, MouseEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  // Base structural integrity: strictly isolated hardware rendering context
  "group relative isolate overflow-hidden rounded-[2.5rem] transition-all duration-700 ease-out will-change-transform",
  {
    variants: {
      variant: {
        ethereal:
          // Extreme blur, micro ink border, sharp top highlight, and anchoring gravity shadow
          "bg-white/20 backdrop-blur-[32px] border border-ethereal-ink/10 shadow-[0_24px_60px_-12px_rgba(22,20,18,0.15),inset_0_1px_0_rgba(255,255,255,0.4)]",
        solid:
          "bg-ethereal-marble border border-ethereal-ink/10 shadow-[0_8px_30px_-4px_rgba(22,20,18,0.1)]",
        dark: "bg-ethereal-ink/90 backdrop-blur-[48px] border border-ethereal-incense/20 text-ethereal-marble shadow-[0_30px_80px_-15px_rgba(0,0,0,0.5)]",
        outline:
          "bg-transparent border border-ethereal-incense/30 transition-colors hover:border-ethereal-gold hover:shadow-[0_8px_32px_rgba(194,168,120,0.15)]",
        light:
          // Subtle variance for secondary telemetry widgets
          "bg-white/10 backdrop-blur-[5px]  border border-ethereal-ink/5 shadow-[0_12px_40px_-8px_rgba(22,20,18,0.08),inset_0_1px_0_rgba(255,255,255,0.3)]",
      },
      isHoverable: {
        // Leverages massive depth translation to convey tactile response
        true: "hover:-translate-y-2 hover:scale-[1.002] cursor-pointer hover:shadow-[0_40px_80px_-16px_rgba(22,20,18,0.25),inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-white/10 hover:border-ethereal-ink/15",
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
    // Kinematic vectors for the internal illumination matrix
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
        style={props.style}
        {...props}
      >
        {/*
          THE KINEMATIC GLOW LAYER
          Ethereal Gold refractions mapped to mouse coordinates.
        */}
        {glow && (
          <motion.div
            className="pointer-events-none absolute -inset-px z-0 rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  150px circle at ${mouseX}px ${mouseY}px,
                  rgba(194, 168, 120, 0.07),
                  transparent 80%
                )
              `,
            }}
            aria-hidden="true"
          />
        )}

        {/* DOMAIN BACKGROUND INJECTION (Mix-blend applied for deep texture integration) */}
        {backgroundElement && (
          <div
            className="absolute inset-0 -z-20 overflow-hidden mix-blend-overlay"
            aria-hidden="true"
          >
            {backgroundElement}
          </div>
        )}

        {/* FILM GRAIN (Sacral texture micro-details) */}
        {withNoise && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-noise opacity-[0.03] mix-blend-color-burn"
            aria-hidden="true"
          />
        )}

        {/* CONTENT STRATUM */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
