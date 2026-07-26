/**
 * @file StatePanel.tsx
 * @description Reusable empty, warning, and recovery surface for feature states.
 * Provides a consistent editorial layout for iconography, copy, and actions.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

type StateTone = "default" | "warning" | "danger";
type StateVariant = "page" | "inline";

export interface StatePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  tone?: StateTone;
  align?: "left" | "center";
  /**
   * `page` owns its own surface and is the state of a whole work area.
   * `inline` drops the surface, the ring and the heading scale for an empty
   * that already sits inside a `SectionCard` body — a card nested in a card
   * reads as a rendering accident, and a 2xl heading outshouts the real
   * content of every sibling card in the column.
   */
  variant?: StateVariant;
}

const toneClassMap: Record<StateTone, string> = {
  default:
    "border-ethereal-incense/15 bg-ethereal-alabaster/70 text-ethereal-graphite/60",
  warning:
    "border-ethereal-gold/25 bg-ethereal-gold/10 text-ethereal-gold",
  danger:
    "border-ethereal-crimson/20 bg-ethereal-crimson/10 text-ethereal-crimson",
};

const inlineToneClassMap: Record<StateTone, string> = {
  default: "text-ethereal-incense/40",
  warning: "text-ethereal-gold/60",
  danger: "text-ethereal-crimson/60",
};

export function StatePanel({
  icon,
  title,
  description,
  eyebrow,
  actions,
  tone = "default",
  align = "center",
  variant = "page",
  className,
  ...props
}: StatePanelProps): React.JSX.Element {
  const isCentered = align === "center";

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col justify-center gap-2 py-6",
          isCentered ? "items-center text-center" : "items-start text-left",
          className,
        )}
        {...props}
      >
        <span className={inlineToneClassMap[tone]} aria-hidden="true">
          {icon}
        </span>
        {eyebrow && <Eyebrow color="muted">{eyebrow}</Eyebrow>}
        <Text size="base" weight="medium" color="graphite">
          {title}
        </Text>
        {description && (
          <Caption color="muted" className="max-w-xs text-pretty">
            {description}
          </Caption>
        )}
        {actions && <div className="mt-1 flex items-center gap-2">{actions}</div>}
      </div>
    );
  }

  return (
    <GlassCard
      variant="light"
      padding="lg"
      isHoverable={false}
      className={className}
      contentClassName={cn(
        "gap-5",
        isCentered ? "items-center text-center" : "items-start text-left",
      )}
      {...props}
    >
      <div
        className={cn("rounded-full border p-4 shadow-sm", toneClassMap[tone])}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className={cn("space-y-2", isCentered && "max-w-2xl")}>
        {eyebrow && <Eyebrow color="muted">{eyebrow}</Eyebrow>}
        <Heading as="h3" size="2xl" weight="medium">
          {title}
        </Heading>
        {description && (
          <Text color="graphite" className="max-w-2xl">
            {description}
          </Text>
        )}
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
