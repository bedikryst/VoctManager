/**
 * @file Typography.tsx
 * @description Core CVA engine for Ethereal UI typography.
 * Internal primitive. Do not use directly in domain components.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

export const typographyVariants = cva("transition-colors duration-500", {
  variants: {
    variant: {
      body: "font-sans leading-relaxed",
      heading: "font-serif tracking-tight",
      eyebrow: "font-sans uppercase tracking-[0.2em] xl:tracking-[0.4em]",
      metric: "font-serif font-light tracking-tight",
      emphasis: "font-serif italic tracking-wide",
      unit: "font-serif italic tracking-normal",
    },
    size: {
      xs: "text-[10px]",
      sm: "text-xs",
      base: "text-sm", // Standard 2026 high-density UI
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-[22px]",
      "3xl": "text-3xl",
      "4xl": "text-3xl lg:text-4xl",
      huge: "text-3xl lg:text-5xl xl:text-6xl",
    },
    weight: {
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      default: "text-ethereal-ink",
      gold: "text-ethereal-gold",
      incense: "text-ethereal-incense/60",
      muted: "text-ethereal-graphite/60",
      white: "text-white",
      inherit: "text-inherit",
    },
  },
});

export interface TypographyProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "color">,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
}

export const TypographyBase = React.forwardRef<HTMLElement, TypographyProps>(
  (
    {
      className,
      variant,
      size,
      weight,
      color,
      as: Component = "span",
      ...props
    },
    ref,
  ) => {
    return (
      <Component
        ref={ref}
        className={cn(
          typographyVariants({ variant, size, weight, color }),
          className,
        )}
        {...props}
      />
    );
  },
);

TypographyBase.displayName = "TypographyBase";
