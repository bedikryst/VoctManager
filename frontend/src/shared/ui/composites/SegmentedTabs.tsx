/**
 * @file SegmentedTabs.tsx
 * @description Canonical segmented tab switcher (gold active pill on an
 * alabaster track) — same visual contract as the project dashboard filters,
 * so every surface switches views with one identical, premium control.
 * Full-width on touch, hugging on desktop. Pass `wrap` when the control lives in a
 * narrow, fixed-width container (e.g. a sidebar) so segments wrap onto a second row
 * instead of overflowing behind a hidden scrollbar.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/primitives/typography";

export interface SegmentedTabItem<TId extends string> {
  id: TId;
  label: string;
  Icon?: LucideIcon;
  /**
   * How many rows the segment would show. A filter's own size is what tells the
   * reader there is work behind it, so it belongs on the control rather than in
   * a sentence beside it — but it is the segment's, not a legend's: nothing
   * else on the surface may restate it.
   */
  count?: number;
}

interface SegmentedTabsProps<TId extends string> {
  items: readonly SegmentedTabItem<TId>[];
  value: TId;
  onChange: (id: TId) => void;
  ariaLabel?: string;
  className?: string;
  /** Wrap segments onto a second row in narrow containers instead of h-scrolling. */
  wrap?: boolean;
}

export function SegmentedTabs<TId extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  wrap = false,
}: SegmentedTabsProps<TId>): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-full max-w-full gap-1 rounded-control border border-hairline-strong bg-ethereal-alabaster/70 p-1",
        wrap
          ? "flex-wrap"
          : "overflow-x-auto no-scrollbar sm:inline-flex sm:w-max",
        className,
      )}
    >
      {items.map(({ id, label, Icon, count }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-chip px-3.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              wrap ? "grow basis-24" : "flex-1 shrink-0 sm:flex-none",
              isActive
                ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                : "text-ethereal-graphite hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
            )}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            <Label size="sm" weight="semibold" color="inherit">
              {label}
            </Label>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-chip px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-ethereal-ink/10 text-ethereal-ink"
                    : "bg-ethereal-ink/5 text-ethereal-graphite/70",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
