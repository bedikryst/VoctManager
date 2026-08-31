/**
 * @file fieldShell.ts
 * @description The surface a form control wears — fill, hairline, inner shadow,
 * focus ring, placeholder colour — with no layout in it. Every field in the
 * product draws from here: the bare `<input>` and `<textarea>`, the select
 * trigger, the date field, the segmented clock. That is the point — a field
 * built from an input and a field built from a listbox sit in the same form and
 * cannot be allowed to drift into two different golds. Padding, flex and
 * typography stay at the call site: the shell says what the box is made of, not
 * how its contents are arranged.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/fieldShell
 */

import { cva, type VariantProps } from "class-variance-authority";

/**
 * The type scale a control that TAKES TYPED TEXT is allowed to use — `<input>`,
 * `<textarea>`, `<select>`. Never under 16px on a touch device.
 *
 * iOS magnifies the whole page the instant focus lands in a field whose
 * font-size is below 16px, and a home-screen (standalone) app does NOT zoom back
 * out on blur the way a Safari tab does: the member is left with the app scaled
 * 16/14 = 1.14x, spilling off both edges, until they pinch it back by hand. The
 * compact 12/14px scale therefore returns only behind `fine-pointer:`, where no
 * such magnification exists.
 *
 * Written as whole literal class strings, not composed at runtime: Tailwind
 * scans source text, so a size assembled from fragments generates no CSS.
 * A control the user cannot type into — Select's button trigger, DateTimeField's
 * button — is exempt and keeps its own scale.
 */
export const FIELD_TEXT_SCALE = {
  sm: "text-base fine-pointer:text-sm",
  xs: "text-base fine-pointer:text-xs",
  /** The two search fields, drawn a half-step under the body scale. */
  search: "text-base fine-pointer:text-[15px]",
} as const;

export const fieldShellVariants = cva(
  // `placeholder:` is inert on the controls that are not inputs (a button has no
  // `::placeholder`); it lives here anyway so the one field that does have a
  // placeholder cannot state its colour twice. Select's own placeholder is a
  // Radix data-attribute and stays with its layout.
  `w-full rounded-control ${FIELD_TEXT_SCALE.sm} text-ethereal-ink placeholder:text-ethereal-incense transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50`,
  {
    variants: {
      variant: {
        // No backdrop-blur: the fill is 90% opaque, so a blur behind it buys
        // nothing but a compositing layer per field — the same call `GlassCard`
        // made for its default surface.
        // The inset is `--glass-contact`, not a literal: it is the line where
        // the field's floor meets its rim, and 6% of ink over a dark fill is
        // nothing at all — the most repeated surface in the panel would lose
        // its sunken read on the dark theme. Arbitrary shadow colours are
        // inlined at build time, so a variable is the only thing a theme can
        // reach here (panel.css says why).
        glass:
          "bg-ethereal-marble/90 border border-ethereal-gold/35 shadow-[inset_0_1px_2px_var(--glass-contact)] hover:border-ethereal-gold/55 focus:bg-ethereal-marble focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20",
        solid:
          "bg-ethereal-marble border border-hairline-strong shadow-glass-solid hover:border-ethereal-gold/40 focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
        // For a field sitting ON a dark island — the practice dock, the viewer
        // chrome. The island is dark in BOTH themes, so neither its fill nor
        // the value typed into it may ride the ladder: `ink` and `alabaster`
        // would swap places under it and leave the field white-on-white.
        dark: "bg-surface-inverse/80 backdrop-blur-xl border border-ethereal-gold/20 text-ink-on-inverse shadow-2xl hover:border-ethereal-gold/40 focus:bg-surface-inverse focus:border-ethereal-gold/60 focus:ring-ethereal-gold/20",
        // The base turns the ring on for every variant; without a colour here it
        // would fall back to `currentColor` and draw a 2px ink halo round a
        // field whose whole point is to be almost invisible at rest. The
        // transparent border must carry a WIDTH, or the field is 2px shorter
        // than its glass sibling in the same row and `focus:border-*` has
        // nothing to paint on. A caller wanting a resting edge (the budget
        // ledger's underline) adds its own side.
        ghost:
          "bg-transparent border border-transparent hover:bg-ethereal-parchment/40 focus:bg-ethereal-marble/80 focus:border-ethereal-gold/40 focus:ring-ethereal-gold/20",
      },
      // The fill is tinted and the placeholder goes crimson, but the value stays
      // ink: what the user typed or picked is not the alarm — the border, the
      // tint and the message under the field are. Crimson text here would also
      // be unreadable on the dark variant.
      hasError: {
        true: "border-ethereal-crimson bg-ethereal-crimson/5 placeholder:text-ethereal-crimson/70 focus:border-ethereal-crimson focus:ring-ethereal-crimson/20",
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
