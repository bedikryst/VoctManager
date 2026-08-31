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
  /**
   * Square 36px segments carrying the icon alone; `label` becomes the accessible
   * name and the tooltip. Reserved for a two-or-three-state *density* toggle
   * (grid ↔ list) sitting inside a toolbar row, where a spelled-out label would
   * push the search field off a phone. A switcher between two bodies of CONTENT
   * always keeps its words — an icon cannot say "Frekwencja".
   */
  iconOnly?: boolean;
  /**
   * `dark` is the same control on an inverse surface — the concert sheet, and
   * any other `BottomSheet tone="dark"`. Its track is a wash of that surface's
   * own fill rather than a rung, so it stays sunken into the island on both
   * themes instead of inverting out of it.
   * It exists so a dark surface does not have
   * to type its own track: the one that did also gave each segment a DIFFERENT
   * active colour (gold for one tab, sage for the next), which spends the
   * accent scale on saying something the label already says.
   */
  tone?: "light" | "dark";
}

export function SegmentedTabs<TId extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  wrap = false,
  iconOnly = false,
  tone = "light",
}: SegmentedTabsProps<TId>): React.JSX.Element {
  const isDark = tone === "dark";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-full max-w-full gap-1 rounded-control border p-1",
        isDark
          ? "border-ethereal-incense/20 bg-surface-inverse/40"
          : "border-hairline-strong bg-ethereal-alabaster/70",
        iconOnly
          ? "inline-flex w-auto"
          : wrap
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
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              iconOnly
                ? "h-9 w-9 shrink-0 p-0"
                : cn(
                    "px-3.5 py-2",
                    wrap ? "grow basis-24" : "flex-1 shrink-0 sm:flex-none",
                  ),
              isActive
                ? "bg-ethereal-gold text-surface-inverse shadow-sm"
                : isDark
                  ? "text-ink-on-inverse/70 hover:bg-ink-on-inverse/8 hover:text-ink-on-inverse"
                  : "text-ethereal-graphite hover:bg-ethereal-ink/4 hover:text-ethereal-ink",
            )}
          >
            {Icon && <Icon size={iconOnly ? 16 : 14} aria-hidden="true" />}
            {!iconOnly && (
              <Label size="sm" weight="semibold" color="inherit">
                {label}
              </Label>
            )}
            {!iconOnly && count !== undefined && (
              <span
                className={cn(
                  "rounded-chip px-1.5 py-0.5 text-overline-sm font-semibold tabular-nums",
                  // The active count rides the gold pill, so it reads against
                  // an accent rather than against the page: both its wash and
                  // its figure stay on the inverse surface, which does not
                  // invert underneath the fill the way the ink rung does.
                  isActive
                    ? "bg-surface-inverse/10 text-surface-inverse"
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
