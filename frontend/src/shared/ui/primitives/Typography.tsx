/**
 * @file Typography.tsx
 * @description Centralized typographic primitive using CVA.
 * Enforces Ethereal UI design language tokens strictly.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const typographyVariants = cva("transition-colors duration-500", {
  variants: {
    variant: {
      body: "font-sans text-base leading-relaxed",
      eyebrow:
        "text-[10px] font-bold uppercase tracking-[0.25em] md:tracking-[0.4em]",
      metric: "font-serif text-4xl font-light tracking-tight lg:text-5xl",
      metricHuge: "font-serif text-5xl font-light tracking-tight lg:text-6xl",
      title: "font-serif text-3xl leading-[1.1] tracking-tight md:text-5xl",
      unit: "font-serif text-sm italic tracking-normal",
    },
    color: {
      default: "text-ethereal-ink",
      gold: "text-ethereal-gold",
      incense: "text-ethereal-incense/60",
      muted: "text-ethereal-graphite/60",
      inherit: "text-inherit",
    },
  },
  defaultVariants: {
    variant: "body",
    color: "default",
  },
});

export interface TypographyProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "color">,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
}
export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, color, as: Component = "span", ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(typographyVariants({ variant, color }), className)}
        {...props}
      />
    );
  },
);

Typography.displayName = "Typography";
