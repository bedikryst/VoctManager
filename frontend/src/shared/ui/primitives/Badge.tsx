/**
 * @file Badge.tsx
 * @description Standardised micro-status indicator.
 * Refactored to Enterprise SaaS 2026 standard. Embraces Ethereal UI token taxonomy.
 * Zero Tech-Debt. Strict TypeScript 7.0 compliance.
 * @module shared/ui/primitives/Badge
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all duration-300",
  {
    variants: {
      variant: {
        success:
          "bg-ethereal-sage/10 text-ethereal-sage border-ethereal-sage/30 shadow-sm",
        warning:
          "bg-ethereal-gold/10 text-ethereal-gold border-ethereal-gold/40 shadow-sm",
        danger:
          "bg-ethereal-incense/10 text-ethereal-incense border-ethereal-incense/30 shadow-sm",
        amethyst:
          "bg-ethereal-amethyst/10 text-ethereal-amethyst border-ethereal-amethyst/30 shadow-sm",
        neutral:
          "bg-ethereal-alabaster text-ethereal-graphite border-ethereal-incense/20",
        brand:
          "bg-ethereal-ink/5 text-ethereal-ink border-ethereal-incense/30 backdrop-blur-sm",
        outline:
          "bg-transparent text-ethereal-graphite border-ethereal-incense/30",
        glass:
          "bg-white/45 backdrop-blur-[8px] text-ethereal-ink border-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_8px_rgba(166,146,121,0.05)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional icon rendered prior to the text */
  icon?: React.ReactNode;
}

export function Badge({
  variant,
  icon,
  className,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {icon && (
        <span
          className="shrink-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
