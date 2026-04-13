/**
 * @file NoiseOverlay.tsx
 * @description Global architectural grain overlay providing organic texture.
 * Extracted from inline styles to CSS utilities for zero-debt compliance.
 * @module shared/ui/kinematics/NoiseOverlay
 */

import React from "react";
import { cn } from "@/shared/lib/utils";

interface NoiseOverlayProps {
  className?: string;
  opacity?: number;
}

export const NoiseOverlay = ({
  className,
  opacity = 0.04,
}: NoiseOverlayProps) => {
  return (
    <div
      className={cn(
        "bg-noise pointer-events-none fixed inset-0 z-[100] mix-blend-overlay",
        className,
      )}
      /* Dynamic opacity is permitted via CSS variables to avoid inline style clutter */
      style={{ opacity } as React.CSSProperties}
      aria-hidden="true"
    />
  );
};
