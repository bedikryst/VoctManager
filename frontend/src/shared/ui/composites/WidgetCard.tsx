/**
 * @file WidgetCard.tsx
 * @description Canonical surface for Overview/dashboard summary widgets. Replaces the
 * eight bespoke header+padding variations that made the project Overview read as a
 * grab-bag. One consistent shell: a compact icon+title header with an optional action
 * slot, content-sized body (no forced min-height — cards no longer waste vertical
 * space), and an optional footer rail. Pass `onActivate` to make the whole card a
 * deep-link button (hover lift signals it) — the action slot still stops propagation.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/WidgetCard
 */

import React from "react";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow } from "@/shared/ui/primitives/typography";

export interface WidgetCardProps {
  readonly title: string;
  readonly icon?: React.ReactNode;
  /** Right-aligned header slot (e.g. a small action button or shortcut link). */
  readonly action?: React.ReactNode;
  /** Makes the whole card a button that deep-links to its work area. */
  readonly onActivate?: () => void;
  readonly footer?: React.ReactNode;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly children: React.ReactNode;
}

export function WidgetCard({
  title,
  icon,
  action,
  onActivate,
  footer,
  ariaLabel,
  className,
  bodyClassName,
  children,
}: WidgetCardProps): React.JSX.Element {
  return (
    <GlassCard
      variant="solid"
      padding="none"
      isHoverable={Boolean(onActivate)}
      onClick={onActivate}
      role={onActivate ? "button" : "region"}
      aria-label={ariaLabel}
      className={cn("flex flex-col", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-ethereal-ink/6 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className="shrink-0 text-ethereal-gold/70" aria-hidden="true">
              {icon}
            </span>
          )}
          <Eyebrow as="h3" color="graphite" className="truncate">
            {title}
          </Eyebrow>
        </div>
        {action && (
          // Stop propagation so the action never triggers the card's onActivate.
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            {action}
          </div>
        )}
      </header>

      <div className={cn("flex flex-1 flex-col p-5", bodyClassName)}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-ethereal-ink/6 px-5 py-3">{footer}</div>
      )}
    </GlassCard>
  );
}
