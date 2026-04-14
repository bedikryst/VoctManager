/**
 * @file ProgressBar.tsx
 * @description Highly styled progress indicator for metrics and quotas.
 * Refactored to Ethereal UI (2026): calibrated for Alabaster backgrounds,
 * incorporating monumental typography and kinetic flow transitions.
 * @module shared/ui/primitives/ProgressBar
 */
import React from "react";
import { cn } from "@/shared/lib/utils";

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}

export const ProgressBar = ({
  label,
  value,
  total,
  colorClass,
}: ProgressBarProps): React.JSX.Element => {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 group/progress">
      {/* Voice Label - Crisp and ethereal */}
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite w-5">
        {label}
      </span>

      {/* Ethereal Track - A subtle groove in the alabaster surface */}
      <div className="flex-1 h-1.5 bg-ethereal-incense/15 rounded-full overflow-hidden shadow-inner">
        {/* Ethereal Fill - Flowing smoothly into place */}
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-out w-[var(--progress)]",
            "relative after:absolute after:inset-0 after:bg-white/20", // Subtle glassy sheen
            colorClass,
          )}
          /* Ephemeral variable injection: bypasses inline-style restrictions elegantly. */
          style={{ "--progress": `${percentage}%` } as React.CSSProperties}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>

      {/* Value - Anchored with monumental serif typography */}
      <span className="text-[11px] font-bold text-ethereal-ink w-5 text-right font-sans tracking-wide">
        {value}
      </span>
    </div>
  );
};
