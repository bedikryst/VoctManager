/**
 * @file KineticGlow.tsx
 * @description Sacral atmosphere shader element for background blending.
 * @architecture Enterprise SaaS 2026
 */
import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const glowVariants = cva(
  "pointer-events-none absolute h-[300px] w-[300px] rounded-full blur-[80px] transition-transform duration-[1500ms]",
  {
    variants: {
      variant: {
        sage: "bg-gradient-to-r from-ethereal-sage/15 to-transparent",
        gold: "bg-gradient-to-r from-ethereal-gold/10 to-transparent",
        incense: "bg-gradient-to-r from-ethereal-incense/15 to-transparent",
      },
      position: {
        left: "-left-32 top-0 -translate-y-1/2 group-hover/alert:translate-x-16 group-hover/alert:scale-110",
        right:
          "-right-32 bottom-0 translate-y-1/4 group-hover/alert:-translate-x-16 group-hover/alert:scale-110",
      },
    },
    defaultVariants: {
      variant: "sage",
      position: "left",
    },
  },
);

export interface KineticGlowProps extends VariantProps<typeof glowVariants> {
  className?: string;
}

export const KineticGlow: React.FC<KineticGlowProps> = ({
  variant,
  position,
  className,
}) => (
  <div
    className={cn(glowVariants({ variant, position }), className)}
    aria-hidden="true"
  />
);
