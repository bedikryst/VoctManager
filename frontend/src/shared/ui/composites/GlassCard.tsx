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
          "bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.03)]",
        solid: "bg-white/95 border border-stone-200/60 shadow-sm",
        dark: "bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 text-white shadow-2xl",
        outline:
          "bg-transparent border border-stone-200/40 hover:border-stone-300/60",
      },
      glow: {
        true: "after:absolute after:inset-0 after:-z-10 after:opacity-0 after:shadow-[0_0_50px_-12px_var(--tw-shadow-color)] after:shadow-brand/30 after:transition-opacity after:duration-500 hover:after:opacity-100",
      },
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
            className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
