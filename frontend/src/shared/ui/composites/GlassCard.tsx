/**
 * @file GlassCard.tsx
 * @description High-end structural container providing layered glassmorphism.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/GlassCard
 */

import React, { forwardRef, MouseEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  "group relative isolate overflow-hidden rounded-[2.5rem] transition-all duration-700 ease-out",
  {
    variants: {
      variant: {
        ethereal:
          "bg-white/15 backdrop-blur-[24px] border-t border-l border-white/60 border-b border-r border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_12px_40px_rgba(166,146,121,0.08)]",
        solid:
          "bg-ethereal-marble/95 border border-ethereal-incense/15 shadow-glass-solid",
        dark: "bg-ethereal-ink/80 backdrop-blur-[48px] border border-ethereal-incense/20 text-ethereal-marble shadow-2xl",
        outline:
          "bg-transparent border border-ethereal-incense/30 hover:border-ethereal-gold hover:shadow-[0_4px_24px_rgba(194,168,120,0.15)]",
        light:
          "bg-white/10 backdrop-blur-[4px] border-t border-l border-white/60 border-b border-r border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_12px_40px_rgba(166,146,121,0.08)]",
      },
      isHoverable: {
        true: "hover:-translate-y-1.5 hover:scale-[1.002] cursor-pointer hover:shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_20px_50px_rgba(166,146,121,0.15)] hover:bg-white/25",
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
        style={props.style}
        {...props}
      >
        {glow && (
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100 z-0"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  300px circle at ${mouseX}px ${mouseY}px,
                  rgba(255, 255, 255, 0.4),
                  transparent 80%
                )
              `,
            }}
            aria-hidden="true"
          />
        )}

        {backgroundElement && (
          <div
            className="absolute inset-0 -z-20 overflow-hidden mix-blend-overlay"
            aria-hidden="true"
          >
            {backgroundElement}
          </div>
        )}

        {withNoise && (
          <div
            className="absolute inset-0 -z-10 bg-noise opacity-[0.03] mix-blend-color-burn pointer-events-none"
            aria-hidden="true"
          />
        )}

        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
