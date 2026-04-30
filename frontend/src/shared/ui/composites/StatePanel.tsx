/**
 * @file StatePanel.tsx
 * @description Reusable empty, warning, and recovery surface for feature states.
 * Provides a consistent editorial layout for iconography, copy, and actions.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

type StateTone = "default" | "warning" | "danger";

export interface StatePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  tone?: StateTone;
  align?: "left" | "center";
}

const toneClassMap: Record<StateTone, string> = {
  default:
    "border-ethereal-incense/15 bg-ethereal-alabaster/70 text-ethereal-graphite/60",
  warning:
    "border-ethereal-gold/25 bg-ethereal-gold/10 text-ethereal-gold",
  danger:
    "border-ethereal-crimson/20 bg-ethereal-crimson/10 text-ethereal-crimson",
};

export function StatePanel({
  icon,
  title,
  description,
  eyebrow,
  actions,
  tone = "default",
  align = "center",
  className,
  ...props
}: StatePanelProps): React.JSX.Element {
  const isCentered = align === "center";

  return (
    <GlassCard
      variant="light"
      padding="lg"
      isHoverable={false}
      className={cn(
        "flex flex-col gap-5",
        isCentered ? "items-center text-center" : "items-start text-left",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "rounded-full border p-4 shadow-sm",
          toneClassMap[tone],
        )}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className={cn("space-y-2", isCentered && "max-w-2xl")}>
        {eyebrow && <Eyebrow color="muted">{eyebrow}</Eyebrow>}
        <Heading as="h3" size="2xl" weight="medium">
          {title}
        </Heading>
        <Text color="graphite" className="max-w-2xl">
          {description}
        </Text>
      </div>

      {actions && (
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row",
            !isCentered && "sm:justify-start",
          )}
        >
          {actions}
        </div>
      )}
    </GlassCard>
  );
}
