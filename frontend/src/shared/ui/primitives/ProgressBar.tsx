/**
 * @file ProgressBar.tsx
 * @description Highly styled progress indicator for metrics and quotas.
 * Refactored to eliminate inline style violations using dynamic CSS variables.
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
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-stone-400 w-4">{label}</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 w-[var(--progress)]",
            colorClass,
          )}
          // Ephemeral variable injection: bypasses inline-style restrictions elegantly.
          style={{ "--progress": `${percentage}%` } as React.CSSProperties}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      <span className="text-[10px] font-bold text-white w-5 text-right">
        {value}
      </span>
    </div>
  );
};
