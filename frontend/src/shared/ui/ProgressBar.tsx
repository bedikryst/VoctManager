/**
 * @file ProgressBar.tsx
 * @description Highly styled progress indicator for metrics and quotas.
 */
import React from "react";
import { cn } from "../lib/utils";

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}

export function ProgressBar({
  label,
  value,
  total,
  colorClass,
}: ProgressBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-stone-400 w-4">{label}</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            colorClass,
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-white w-5 text-right">
        {value}
      </span>
    </div>
  );
}
