/**
 * @file CompletionRing.tsx
 * @description Compact radial progress dial. Pure SVG, no motion infrastructure —
 * cheap enough to render in dense lists (roll-call rows, schedule readiness).
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/CompletionRing
 */

import React from "react";
import { cn } from "@/shared/lib/utils";

interface CompletionRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Ethereal token for the progress arc. */
  tone?: "gold" | "sage" | "crimson" | "graphite";
  children?: React.ReactNode;
  className?: string;
}

const TONE_STROKE: Record<NonNullable<CompletionRingProps["tone"]>, string> = {
  gold: "stroke-ethereal-gold",
  sage: "stroke-ethereal-sage",
  crimson: "stroke-ethereal-crimson",
  graphite: "stroke-ethereal-graphite/50",
};

export const CompletionRing = React.memo(
  ({
    value,
    size = 40,
    strokeWidth = 4,
    tone = "gold",
    children,
    className,
  }: CompletionRingProps): React.JSX.Element => {
    const clamped = Math.max(0, Math.min(100, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clamped / 100) * circumference;

    return (
      <div
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-ethereal-ink/8"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-out",
              TONE_STROKE[tone],
            )}
          />
        </svg>
        {children && (
          <span className="absolute inset-0 flex items-center justify-center">
            {children}
          </span>
        )}
      </div>
    );
  },
);

CompletionRing.displayName = "CompletionRing";
