/**
 * @file SectionCard.tsx
 * @description The panel's only card shell: a solid surface with a compact
 * icon + overline header on a hairline rule, a body that is either padded or a
 * scroll region, and an optional footer rail. Every card header in the product
 * comes from here — the header was previously re-typed by hand in a dozen
 * files, in four paddings and three hairline colours, which is what made one
 * screen read as several products stacked together.
 * The header always lives INSIDE the card. A title floating above a bare
 * surface is the other half of that inconsistency and is not an option here.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/SectionCard
 */

import React from "react";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow } from "@/shared/ui/primitives/typography";

export interface SectionCardProps {
  readonly title: string;
  readonly icon?: React.ReactNode;
  /** Right-aligned header slot — a small action, a count, a status chip. */
  readonly action?: React.ReactNode;
  /**
   * Non-scrolling strip between header and body — a search field, a filter row.
   * It must stay pinned while the body scrolls, which is why it is a slot and
   * not just the first child.
   */
  readonly toolbar?: React.ReactNode;
  readonly footer?: React.ReactNode;
  /**
   * Heading level. `h2` for a work area's own sections, `h3` for a card that
   * sits inside a grid under a page heading.
   */
  readonly as?: "h2" | "h3";
  /**
   * Body fills the card and scrolls instead of growing. Pair with a max-height
   * on `className` — without one there is nothing to scroll against.
   */
  readonly scroll?: boolean;
  /** Makes the whole card a deep-link button; the action slot stops propagation. */
  readonly onActivate?: () => void;
  readonly ariaLabel?: string;
  /** Card surface. Layout for the children belongs on `bodyClassName`. */
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly children: React.ReactNode;
}

export function SectionCard({
  title,
  icon,
  action,
  toolbar,
  footer,
  as = "h3",
  scroll = false,
  onActivate,
  ariaLabel,
  className,
  bodyClassName,
  children,
}: SectionCardProps): React.JSX.Element {
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
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className="shrink-0 text-ethereal-gold/70" aria-hidden="true">
              {icon}
            </span>
          )}
          <Eyebrow as={as} color="graphite" className="truncate">
            {title}
          </Eyebrow>
        </div>
        {action && (
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            {action}
          </div>
        )}
      </header>

      {toolbar && <div className="shrink-0 px-5 pt-4">{toolbar}</div>}

      <div
        className={cn(
          scroll
            ? "min-h-0 flex-1 overflow-y-auto p-5"
            : "flex flex-1 flex-col p-5",
          bodyClassName,
        )}
      >
        {children}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-hairline px-5 py-3">
          {footer}
        </div>
      )}
    </GlassCard>
  );
}
