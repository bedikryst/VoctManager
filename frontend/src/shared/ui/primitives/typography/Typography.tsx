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
      body: "font-sans",
      heading: "font-serif tracking-tight",
      eyebrow: "font-sans uppercase tracking-[0.14em]",
      // The display figure: one number, read once, so it carries the same
      // serif voice as the heading above it. `lnum` is not optional here —
      // Cormorant's default set is OLDSTYLE, where 3/5/7/9 hang below the
      // baseline and 1 is an x-height glyph indistinguishable from "I".
      // Tabular is deliberately absent: Cormorant pads every tabular digit to
      // a uniform 491/1000 advance, which opens visible gaps around the narrow
      // ones. Figures that must align down a column (ledgers, matrices, the
      // clock) belong to sans + `tabular-nums`, never to this variant.
      metric: "font-serif lining-nums tracking-tight",
      emphasis: "font-serif italic tracking-wide",
      unit: "font-serif italic tracking-normal",
      caption: "font-sans",
    },
    size: {
      // The two sizes of the uppercase overline role (see --text-overline in
      // panel.css). Only `Eyebrow` should reach for these; the tracking that
      // completes the role comes from the `eyebrow` variant above, so a size
      // used on any other variant would carry none.
      overline: "text-overline",
      "overline-sm": "text-overline-sm",
      // `Caption`'s own size, and nobody else's — it is the same 11px as
      // `overline` but as an arbitrary value, so it brings no line-height. On
      // the `caption` variant that is right (the compound below sets
      // `leading-snug`); on an `Eyebrow` it silently dropped the role's 1.15,
      // which is why `Eyebrow` no longer accepts it.
      caption: "text-[11px]",
      xs: "text-[10px]",
      sm: "text-xs",
      base: "text-sm", // Standard 2026 high-density UI
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-[22px]",
      "3xl": "text-3xl",
      "4xl": "text-3xl lg:text-4xl",
      "5xl": "text-4xl lg:text-5xl",
      "6xl": "text-5xl lg:text-6xl",
      huge: "text-3xl lg:text-5xl xl:text-6xl",
    },
    weight: {
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
      black: "font-black",
    },
    color: {
      default: "text-ethereal-ink",
      muted: "text-ethereal-graphite/60",
      gold: "text-ethereal-gold",
      sage: "text-ethereal-sage",
      amethyst: "text-ethereal-amethyst",
      incense: "text-ethereal-incense",
      "incense-muted": "text-ethereal-incense/60",
      graphite: "text-ethereal-graphite",
      // Ink for a surface that is dark in BOTH themes — score chrome, the
      // player dock, the premium island — and for one written ON a hue-holding
      // accent (gold, sage) that wants a LIGHT mark. There is no rung-named
      // light ink beside these on purpose: `marble` / `parchment` / `alabaster`
      // stood here for the same two jobs and read correctly only because the
      // ladder happened to put the brightest rungs at the top. On a dark ground
      // they invert with the page while the island does not, and the surface
      // goes ink-on-ink. Every one of them has been renamed to this pair; if a
      // new call site wants light ink, the question to answer is what its
      // GROUND does, not which rung looks right today.
      "ink-on-inverse": "text-ink-on-inverse",
      "ink-on-inverse-muted": "text-ink-on-inverse/60",
      crimson: "text-ethereal-crimson",
      "crimson-light": "text-ethereal-crimson-light",
      inherit: "text-inherit",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    },
    truncate: {
      true: "truncate",
    },
  },
  // Line-height is a property of the ROLE (prose breathes, a caption does not),
  // not of the size — but tailwind-merge resolves a font-size as owning the
  // line-height, so a `leading-*` declared with the variant is dropped by the
  // `text-*` that follows it. cva applies compound variants after every plain
  // variant and before the caller's `className`, which is exactly the slot this
  // needs: it outlives the size, and a caller's own `leading-*` still wins.
  compoundVariants: [
    { variant: "body", class: "leading-relaxed" },
    { variant: "caption", class: "leading-snug" },
  ],
});

type TypographyDomProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  "color"
> &
  Pick<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "target" | "rel"
  > &
  Pick<React.LabelHTMLAttributes<HTMLLabelElement>, "htmlFor">;

export interface TypographyProps
  extends TypographyDomProps,
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
      align,
      truncate,
      as: Component = "span",
      ...props
    },
    ref,
  ) => {
    return (
      <Component
        ref={ref}
        className={cn(
          typographyVariants({ variant, size, weight, color, align, truncate }),
          className,
        )}
        {...props}
      />
    );
  },
);

TypographyBase.displayName = "TypographyBase";
