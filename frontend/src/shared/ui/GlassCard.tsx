/**
 * @file GlassCard.tsx
 * @description High-end structural container providing layered glassmorphism.
 * Designed for the "Ethereal UI" aesthetic of VoctEnsemble.
 * Features advanced backdrop filters and brand-specific luminance.
 * @module shared/ui/GlassCard
 */

import React, { HTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const glassCardVariants = cva(
  // Base: Foundation of the sacral minimalism - soft corners, subtle transitions
  "relative overflow-hidden rounded-[2.5rem] transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        /** The signature ethereal look: high transparency, deep blur */
        ethereal:
          "bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.03)]",
        /** Solid variant for high-legibility content (e.g. sheet music details) */
        solid: "bg-white/95 border border-stone-200/60 shadow-sm",
        /** Concert mode: deep dark aesthetic with OLED-ready borders */
        dark: "bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 text-white shadow-2xl",
        /** Minimalist outline for secondary information */
        outline:
          "bg-transparent border border-stone-200/40 hover:border-stone-300/60",
      },
      /** Adds a subtle brand-colored ambient glow around the card */
      glow: {
        true: "after:absolute after:inset-0 after:-z-10 after:opacity-0 after:shadow-[0_0_50px_-12px_rgba(0,35,149,0.3)] after:transition-opacity after:duration-500 hover:after:opacity-100",
      },
      /** Interaction state: subtle lift and scale */
      isHoverable: {
        true: "hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl cursor-pointer",
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
  /** If true, renders a subtle noise texture overlay for organic feel */
  withNoise?: boolean;
  /** Custom background element (e.g. an abstract gradient or image) */
  backgroundElement?: React.ReactNode;
  /** * @deprecated Use `padding="none"` according to new CVA 2026 standards.
   * That prop will be removed in the future.
   */
  noPadding?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant,
      padding,
      noPadding,
      glow,
      isHoverable,
      withNoise = false,
      backgroundElement,
      className,
      ...props
    },
    ref,
  ) => {
    const resolvedPadding = noPadding ? "none" : padding;
    return (
      <div
        ref={ref}
        className={cn(
          glassCardVariants({
            variant,
            padding: resolvedPadding,
            glow,
            isHoverable,
            className,
          }),
        )}
        {...props}
      >
        {/* Ambient brand background element if provided */}
        {backgroundElement && (
          <div
            className="absolute inset-0 -z-20 overflow-hidden"
            aria-hidden="true"
          >
            {backgroundElement}
          </div>
        )}

        {/* The Noise Grain: Key for the "Ethereal" texture to avoid plastic look */}
        {withNoise && (
          <div
            className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Content Layer */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
