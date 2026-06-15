/**
 * @file SegmentedTabs.tsx
 * @description Canonical segmented tab switcher (gold active pill on an
 * alabaster track) — same visual contract as the project dashboard filters,
 * so every surface switches views with one identical, premium control.
 * Full-width on touch, hugging on desktop.
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
}

interface SegmentedTabsProps<TId extends string> {
  items: readonly SegmentedTabItem<TId>[];
  value: TId;
  onChange: (id: TId) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedTabs<TId extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedTabsProps<TId>): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 p-1 no-scrollbar sm:inline-flex sm:w-max",
        className,
      )}
    >
      {items.map(({ id, label, Icon }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 sm:flex-none",
              isActive
                ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                : "text-ethereal-graphite hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
            )}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            <Label size="sm" weight="semibold" color="inherit">
              {label}
            </Label>
          </button>
        );
      })}
    </div>
  );
}
