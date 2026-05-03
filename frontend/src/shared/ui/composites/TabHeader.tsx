/**
 * @file TabHeader.tsx
 * @description Editorial header for editor-style tabs. Standardises the
 * "icon medallion + title + subtitle + actions" pattern that was previously
 * inlined (and drifted) across every tab inside the project editor panel.
 * Two visual rhythms are supported via the `tone` prop, mapped to our token palette.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/TabHeader
 */

import React from "react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text } from "@/shared/ui/primitives/typography";

export type TabHeaderTone = "gold" | "sage" | "amethyst" | "crimson";

export interface TabHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  tone?: TabHeaderTone;
  /** Render right-aligned actions (buttons, badges, links). */
  actions?: React.ReactNode;
  /** Render below the description (badges, chips). */
  meta?: React.ReactNode;
  className?: string;
}

const toneIconClassMap: Record<TabHeaderTone, string> = {
  gold: "border-ethereal-gold/25 bg-ethereal-gold/10 text-ethereal-gold",
  sage: "border-ethereal-sage/30 bg-ethereal-sage/10 text-ethereal-sage",
  amethyst:
    "border-ethereal-amethyst/30 bg-ethereal-amethyst/10 text-ethereal-amethyst",
  crimson:
    "border-ethereal-crimson/25 bg-ethereal-crimson/10 text-ethereal-crimson",
};

export function TabHeader({
  icon,
  title,
  description,
  tone = "gold",
  actions,
  meta,
  className,
}: TabHeaderProps): React.JSX.Element {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-ethereal-incense/15 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <GlassCard
          variant="light"
          padding="none"
          isHoverable={false}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center border",
            toneIconClassMap[tone],
          )}
        >
          <span aria-hidden="true">{icon}</span>
        </GlassCard>

        <div className="min-w-0 flex-1 space-y-1">
          <Heading as="h2" size="xl" weight="medium" className="truncate">
            {title}
          </Heading>
          {description && (
            <Text size="sm" color="muted">
              {description}
            </Text>
          )}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-2">{meta}</div>}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
