/**
 * @file fieldShell.ts
 * @description The surface a form control wears — fill, hairline, inner shadow,
 * focus ring — with no layout in it. Every control that is not a bare `<input>`
 * (the select trigger, the date field, the segmented clock) draws from here, so
 * a field built from a button and a field built from a listbox cannot drift into
 * two different golds. Padding, flex and typography stay at the call site: the
 * shell says what the box is made of, not how its contents are arranged.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/fieldShell
 */

import { cva, type VariantProps } from "class-variance-authority";

export const fieldShellVariants = cva(
  "w-full rounded-control text-sm text-ethereal-ink transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        glass:
          "bg-ethereal-marble/90 border border-ethereal-gold/35 shadow-[inset_0_1px_2px_rgba(22,20,18,0.06)] hover:border-ethereal-gold/55 focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20",
        solid:
          "bg-ethereal-marble border border-hairline-strong shadow-glass-solid hover:border-ethereal-gold/40 focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
        // For a field sitting ON ink — the practice dock, the viewer chrome.
        // Byte-for-byte `Input`'s dark, so the two cannot drift into two darks.
        dark: "bg-ethereal-ink/80 backdrop-blur-xl border border-ethereal-gold/20 text-ethereal-alabaster shadow-2xl hover:border-ethereal-gold/40 focus:bg-ethereal-ink focus:border-ethereal-gold/60 focus:ring-ethereal-gold/20",
        // The base turns the ring on for every variant; without a colour here it
        // would fall back to `currentColor` and draw a 2px ink halo round a
        // field whose whole point is to be almost invisible at rest.
        ghost:
          "bg-transparent border border-transparent hover:bg-ethereal-incense/10 focus:bg-ethereal-marble focus:border-ethereal-gold/40 focus:ring-ethereal-gold/20",
      },
      hasError: {
        true: "border-ethereal-crimson bg-ethereal-crimson/5 text-ethereal-crimson focus:border-ethereal-crimson focus:ring-ethereal-crimson/20",
      },
    },
    defaultVariants: { variant: "glass", hasError: false },
  },
);

export type FieldShellVariantProps = VariantProps<typeof fieldShellVariants>;

/**
 * Focus treatment for a shell whose focus lands on a CHILD — a segmented clock
 * is a div holding two inputs, so the ring must follow `:focus-within` or the
 * field never lights up while it is being typed into.
 */
export const FIELD_SHELL_FOCUS_WITHIN =
  "focus-within:border-ethereal-gold/70 focus-within:ring-2 focus-within:ring-ethereal-gold/20";
