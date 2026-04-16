/**
 * @file MetricBlock.tsx
 * @description Standardized semantic artifact for statistical representation.
 * Handles glassmorphism hover kinematics internally.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cn } from "@/shared/lib/utils";
import { Eyebrow, Metric, Text, Unit } from "@/shared/ui/primitives/typography";

export interface MetricBlockProps extends React.HTMLAttributes<HTMLElement> {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  accentColor?: "default" | "gold";
  interactiveMode?: "glass" | "minimal";
}

export function MetricBlock({
  label,
  value,
  unit,
  icon,
  accentColor = "default",
  interactiveMode = "minimal",
  className,
  ...props
}: MetricBlockProps): React.JSX.Element {
  const isGold = accentColor === "gold";

  const glassClasses =
    interactiveMode === "glass"
      ? "p-5 md:p-6 lg:p-8 transition-colors duration-700 group-hover:bg-white/40 backdrop-blur-sm "
      : "group flex cursor-default flex-col gap-1";

  return (
    <article
      className={cn("relative flex flex-col gap-2", glassClasses, className)}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-1 md:gap-2 transition-colors duration-500",
          interactiveMode === "glass"
            ? "text-ethereal-incense/70"
            : "text-ethereal-incense/60",
          isGold
            ? "group-hover:text-ethereal-gold hover:text-ethereal-gold"
            : "group-hover:text-ethereal-ink/75 hover:text-ethereal-ink/75",
        )}
      >
        {icon &&
          React.cloneElement(
            icon as React.ReactElement<{
              size?: number;
              strokeWidth?: number;
              className?: string;
            }>,
            { size: 14, strokeWidth: 1.5 },
          )}
        <Eyebrow color="inherit">{label}</Eyebrow>
      </div>

      <p className="flex items-baseline gap-2">
        <Metric color={isGold ? "gold" : "default"}>{value}</Metric>
        {unit && (
          <Unit size="sm" color={isGold ? "gold" : "muted"}>
            {unit}
          </Unit>
        )}
      </p>
    </article>
  );
}
