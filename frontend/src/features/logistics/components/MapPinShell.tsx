/**
 * @file MapPinShell.tsx
 * @description The single source of truth for a venue pin's physical chrome —
 * the coloured halo, the floating light disc, and the ground shadow that grounds
 * it on the tiles. Both the global atlas markers and the editor's draggable
 * picker pin render through this shell so every map in the product drops pins
 * with the same weight, bob, and light. Colour + contents are caller-driven.
 *
 * The disc and its cast hold their values through a theme swap rather than
 * riding the ladder: the Google raster is a light map in both themes (the dark
 * one is deferred to its own stage), so a pin that inverted with the panel would
 * turn into a dark disc casting a pale halo over tiles that never moved.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/MapPinShell
 */

import React from "react";

import { cn } from "@/shared/lib/utils";

interface MapPinShellProps {
  /** Halo + ring colour (CSS colour or token var). */
  color: string;
  /** Icon glyph colour. Defaults to `color`. */
  iconColor?: string;
  children: React.ReactNode;
  /** Selected state — lifts, scales, and gilds the ring. */
  active?: boolean;
  /** Draws the eye to "now" with a breathing halo. */
  pulse?: boolean;
  /** Lifts the pin while a drag is in progress (picker only). */
  dragging?: boolean;
  /** Top-right count chip (e.g. multiple events booked here). */
  badge?: React.ReactNode;
}

/**
 * Presentational only — wrap it in `<AdvancedMarker>` (atlas) or render it
 * directly inside one (picker). The `group` hooks let hover lift the disc.
 */
export const MapPinShell = ({
  color,
  iconColor,
  children,
  active = false,
  pulse = false,
  dragging = false,
  badge,
}: MapPinShellProps): React.JSX.Element => (
  <div className="group relative flex flex-col items-center">
    <span
      aria-hidden="true"
      className={cn(
        "absolute -top-2 h-8 w-8 rounded-full opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-80",
        active && "opacity-90",
        pulse && "animate-pulse opacity-70",
        dragging && "opacity-90",
      )}
      style={{ backgroundColor: color }}
    />
    <div
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-full border-2 bg-ink-on-inverse shadow-[0_8px_18px_rgba(22,20,18,0.25)] transition-transform duration-500 group-hover:-translate-y-1",
        active &&
          "-translate-y-1 scale-110 ring-2 ring-ethereal-gold ring-offset-2 ring-offset-transparent",
        dragging && "-translate-y-2 scale-110",
      )}
      style={{ borderColor: color, color: iconColor ?? color }}
    >
      {children}
      {badge}
    </div>
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 h-1 w-1.5 rounded-full bg-black/40 blur-[2px] transition-all duration-500",
        (active || dragging) && "h-1 w-2 bg-black/30",
      )}
    />
  </div>
);
