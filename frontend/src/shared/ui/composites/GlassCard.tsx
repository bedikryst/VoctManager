/**
 * @file GlassCard.tsx
 * @description High-end structural container providing layered glassmorphism.
 * Designed for the "Ethereal UI" aesthetic of VoctEnsemble.
 * @module shared/ui/composites/GlassCard
 */

import React, { HTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  "relative overflow-hidden rounded-[2.5rem] transition-all duration-500 ease-out",
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
      glow: {
        true: "after:absolute after:inset-0 after:-z-10 after:opacity-0 after:shadow-[0_0_60px_-10px_var(--tw-shadow-color)] after:shadow-ethereal-gold/40 after:transition-opacity after:duration-700 hover:after:opacity-100",
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
      glow: false,
      isHoverable: false,
    },
  },
);

export interface GlassCardProps
  extends
    HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  /** Renders a subtle noise texture overlay for an organic feel */
  withNoise?: boolean;
  /** Custom background element (e.g., an abstract gradient or image) */
  backgroundElement?: React.ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant,
      padding,
      glow,
      isHoverable,
      withNoise = false,
      backgroundElement,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          glassCardVariants({
            variant,
            padding,
            glow,
            isHoverable,
            className,
          }),
        )}
        {...props}
      >
        {backgroundElement && (
          <div
            className="absolute inset-0 -z-20 overflow-hidden"
            aria-hidden="true"
          >
            {backgroundElement}
          </div>
        )}

        {withNoise && (
          <div
            className="bg-noise absolute inset-0 -z-10 opacity-[0.03] pointer-events-none mix-blend-overlay"
            aria-hidden="true"
          />
        )}

        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
