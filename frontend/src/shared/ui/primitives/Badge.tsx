/**
 * @file Badge.tsx
 * @description THE chip. Every status, tag and count the panel prints inline
 * wears this one — one shape (`rounded-chip`), one type recipe, one set of
 * tones. A second chip component is how a product ends up with two corner
 * radii and two glows for the same sentence.
 * @module shared/ui/primitives/Badge
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-chip border transition-colors duration-300",
  {
    variants: {
      // What the chip CARRIES, which is what decides its type — not its colour.
      // `overline` is a status the system wrote (overline-sm at the control
      // tracking 0.1em; the wider 0.14em belongs to `Eyebrow` and must not leak
      // here, because a chip sits inline with buttons, not with headings).
      // `natural` is content that owns its own casing — a person's name, a
      // filename, a role. Set in caps and tracked out, a name stops reading as
      // a person.
      casing: {
        overline: "text-overline-sm font-bold uppercase tracking-widest",
        natural: "text-xs font-medium tracking-normal",
      },
      variant: {
        success:
          "bg-ethereal-sage/10 text-ethereal-sage border-ethereal-sage/30 shadow-sm",
        warning:
          "bg-ethereal-gold/10 text-ethereal-gold border-ethereal-gold/40 shadow-sm",
        danger:
          "bg-ethereal-crimson/10 text-ethereal-crimson border-ethereal-crimson/30 shadow-sm",
        amethyst:
          "bg-ethereal-amethyst/10 text-ethereal-amethyst border-ethereal-amethyst/30 shadow-sm",
        // The warm neutral of the category scale (`accents.ts`) — the tone a
        // taxonomy claims when it needs one more colour that is not an alarm.
        incense:
          "bg-ethereal-incense/12 text-ethereal-incense border-ethereal-incense/35 shadow-sm",
        neutral:
          "bg-ethereal-ink/4 text-ethereal-graphite border-hairline-strong",
        brand:
          "bg-ethereal-ink/5 text-ethereal-ink border-ethereal-incense/30 backdrop-blur-sm",
        outline:
          "bg-transparent text-ethereal-graphite border-ethereal-incense/30",
        // The frosted chip. Every part of it says "one step brighter than the
        // card I sit on", so every part of it is a rung or a glass variable —
        // the literal white fill and the literal white bevel both stated that
        // in a way that only holds on a cream ground.
        glass:
          "bg-ethereal-marble/45 backdrop-blur-[8px] text-ethereal-ink border-ethereal-marble/80 shadow-[inset_0_1px_1px_var(--glass-highlight),0_2px_8px_var(--glass-shade)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      casing: "overline",
    },
  },
);

/** The tone axis, so a taxonomy can map its accent onto a chip by name. */
export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional icon rendered prior to the text */
  icon?: React.ReactNode;
  /**
   * A light sweep across the chip. It is the panel's only "this is happening
   * now" signal, so spend it on a state that is genuinely live — a project in
   * production, a rehearsal under way. A chip that always pulses says nothing.
   */
  pulse?: boolean;
}

export function Badge({
  variant,
  casing,
  icon,
  pulse = false,
  className,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  const content = (
    <>
      {icon && (
        <span
          className="shrink-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {children}
    </>
  );

  return (
    <span
      className={cn(
        badgeVariants({ variant, casing }),
        pulse && "relative overflow-hidden",
        className,
      )}
      {...props}
    >
      {pulse && (
        <motion.span
          className="absolute inset-0 z-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
          animate={{ x: ["-200%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        />
      )}
      {/* The sweep is positioned, so unpositioned text would paint beneath it. */}
      {pulse ? (
        <span className="relative z-10 inline-flex items-center gap-1.5">
          {content}
        </span>
      ) : (
        content
      )}
    </span>
  );
}
