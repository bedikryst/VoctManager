/**
 * @file RouteTabs.tsx
 * @description The routed tab track: `NavLink`s on a `rounded-nested` marble
 * track, the active one lifted onto marble with a gold icon. A routed switcher
 * changes the address, so it stays links; `SegmentedTabs` is for local view
 * state. Horizontal scrolls within its own track on narrow viewports; vertical
 * stacks full-width entries for a workspace's side column.
 *
 * An item may carry a `count` — the section's own size, said once, on the tab.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/RouteTabs
 */

import React from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

export interface RouteTabItem {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  /** Active only on the exact path — for an index route. */
  readonly end?: boolean;
  readonly count?: number;
}

export interface RouteTabsProps {
  readonly items: readonly RouteTabItem[];
  readonly ariaLabel: string;
  readonly orientation?: "horizontal" | "vertical";
  readonly className?: string;
}

export const RouteTabs = ({
  items,
  ariaLabel,
  orientation = "horizontal",
  className,
}: RouteTabsProps): React.JSX.Element => {
  const isVertical = orientation === "vertical";

  return (
    <nav
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={cn(
        "flex gap-1 rounded-nested border border-hairline bg-ethereal-marble/55 p-1.5 shadow-glass-solid backdrop-blur-md",
        isVertical ? "flex-col" : "no-scrollbar overflow-x-auto",
        className,
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-control px-3.5 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isVertical && "w-full gap-2.5 py-2.5",
              isActive
                ? "bg-ethereal-marble text-ethereal-ink shadow-[0_1px_3px_var(--glass-contact),0_1px_1px_rgba(194,168,120,0.14)]"
                : "text-ethereal-graphite/65 hover:bg-ethereal-marble/60 hover:text-ethereal-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "shrink-0 transition-colors",
                  isActive ? "text-ethereal-gold" : "text-ethereal-graphite/50",
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <Eyebrow color="inherit" className="min-w-0 truncate">
                {item.label}
              </Eyebrow>
              {item.count !== undefined && (
                <span
                  className={cn(
                    "shrink-0 rounded-chip px-1.5 py-0.5 text-overline-sm font-semibold tabular-nums",
                    isVertical && "ml-auto",
                    isActive
                      ? "bg-ethereal-gold/15 text-ethereal-ink"
                      : "bg-ethereal-ink/5 text-ethereal-graphite/70",
                  )}
                >
                  {item.count}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

RouteTabs.displayName = "RouteTabs";
