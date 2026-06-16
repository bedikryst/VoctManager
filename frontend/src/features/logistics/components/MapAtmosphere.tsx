/**
 * @file MapAtmosphere.tsx
 * @description A non-interactive light treatment laid over the Google tiles so
 * the raw satellite/road raster reads as a framed Ethereal artifact rather than
 * a bolted-on iframe. It contributes an inner vignette (settles the edges into
 * the card), a faint parchment warmth in the corners, and a top sheen — tuned
 * to stay clear of the map's legible centre. Works regardless of whether the
 * cloud-based map style has propagated, so the surface always feels on-brand.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/MapAtmosphere
 */

import React from "react";

import { cn } from "@/shared/lib/utils";

interface MapAtmosphereProps {
  className?: string;
}

export const MapAtmosphere = ({
  className,
}: MapAtmosphereProps): React.JSX.Element => (
  <div
    aria-hidden="true"
    className={cn("pointer-events-none absolute inset-0 z-[5]", className)}
  >
    {/* Inner vignette — grounds the tiles into the glass frame. */}
    <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(22,20,18,0.10),inset_0_1px_2px_rgba(255,255,255,0.5)]" />
    {/* Parchment warmth bleeding from the corners only. */}
    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent_55%,rgba(194,168,120,0.10)_100%)]" />
    {/* Top sheen — a thin breath of light along the upper edge. */}
    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ethereal-marble/25 to-transparent" />
  </div>
);
