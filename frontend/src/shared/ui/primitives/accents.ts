/**
 * @file accents.ts
 * @description SSOT for the panel's CATEGORY accents — the colour a taxonomy
 * hands to its chip, its balance-bar tile, its overline and its map marker.
 * Three dictionaries (voice sections, crew specialties, location categories)
 * each carried a private copy of these class tables, which is how two of them
 * ended up spending `ethereal-crimson` on a resting category: a soprano, a
 * hotel. Crimson is the alarm colour, so it is absent from `EtherealAccent`
 * altogether — a taxonomy cannot reach for it, and a genuine alert keeps the
 * only crimson on the screen.
 *
 * A taxonomy picks an accent; every surface derives its treatment from these
 * tables, so a chip can never disagree with the pin that marks the same thing.
 * @module shared/ui/primitives/accents
 */

import type { BadgeVariant } from "./Badge";

/** The six non-alarm accents a category may claim. */
export type EtherealAccent =
  | "gold"
  | "amethyst"
  | "sage"
  | "graphite"
  | "incense"
  | "ink";

/** Chip tone — the accent as a `Badge` variant. */
export const ACCENT_BADGE: Record<EtherealAccent, BadgeVariant> = {
  gold: "warning",
  amethyst: "amethyst",
  sage: "success",
  graphite: "neutral",
  incense: "incense",
  ink: "brand",
};

/** Typography `color` for an `Eyebrow`/`Text` set in the accent. */
export const ACCENT_TEXT: Record<
  EtherealAccent,
  "gold" | "amethyst" | "sage" | "graphite" | "incense" | "default"
> = {
  gold: "gold",
  amethyst: "amethyst",
  sage: "sage",
  graphite: "graphite",
  incense: "incense",
  ink: "default",
};

/** Proportional-bar fill inside a balance tile. */
export const ACCENT_BAR: Record<EtherealAccent, string> = {
  gold: "bg-ethereal-gold/60",
  amethyst: "bg-ethereal-amethyst/55",
  sage: "bg-ethereal-sage/55",
  graphite: "bg-ethereal-graphite/45",
  incense: "bg-ethereal-incense/55",
  ink: "bg-ethereal-ink/45",
};

/** Balance tile when it is the active filter. */
export const ACCENT_TILE_ACTIVE: Record<EtherealAccent, string> = {
  gold: "border-ethereal-gold/45 bg-ethereal-gold/[0.05] ring-1 ring-ethereal-gold/30",
  amethyst:
    "border-ethereal-amethyst/45 bg-ethereal-amethyst/[0.04] ring-1 ring-ethereal-amethyst/30",
  sage: "border-ethereal-sage/45 bg-ethereal-sage/[0.04] ring-1 ring-ethereal-sage/30",
  graphite:
    "border-ethereal-graphite/40 bg-ethereal-graphite/[0.05] ring-1 ring-ethereal-graphite/25",
  incense:
    "border-ethereal-incense/50 bg-ethereal-incense/[0.06] ring-1 ring-ethereal-incense/30",
  ink: "border-ethereal-ink/35 bg-ethereal-ink/[0.04] ring-1 ring-ethereal-ink/20",
};

/** Balance tile at rest — a hairline that hints the accent on hover. */
export const ACCENT_TILE_IDLE: Record<EtherealAccent, string> = {
  gold: "border-hairline-strong hover:border-ethereal-gold/30",
  amethyst: "border-hairline-strong hover:border-ethereal-amethyst/30",
  sage: "border-hairline-strong hover:border-ethereal-sage/30",
  graphite: "border-hairline-strong hover:border-ethereal-graphite/30",
  incense: "border-hairline-strong hover:border-ethereal-incense/40",
  ink: "border-hairline-strong hover:border-ethereal-ink/25",
};

/**
 * The accent as a raw CSS variable, for the places a class cannot reach —
 * Google Maps markers and inline `style` on a pin shell.
 */
export const ACCENT_MARKER: Record<EtherealAccent, string> = {
  gold: "var(--color-ethereal-gold)",
  amethyst: "var(--color-ethereal-amethyst)",
  sage: "var(--color-ethereal-sage)",
  graphite: "var(--color-ethereal-graphite)",
  incense: "var(--color-ethereal-incense)",
  ink: "var(--color-ethereal-ink)",
};
