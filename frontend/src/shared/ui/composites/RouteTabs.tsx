/**
 * @file RouteTabs.tsx
 * @description The routed tab row. A routed switcher changes the address, so
 * it stays `NavLink`s; `SegmentedTabs` is for local view state.
 *
 * `track`: links on a `rounded-nested` marble track, the active one lifted
 * onto marble with a gold icon. Horizontal scrolls within its own track on
 * narrow viewports; vertical stacks full-width entries for a workspace's side
 * column.
 *
 * `underline`: sentence-case labels at reading size on a hairline, the active
 * one in ink over a 2 px ink bar, the look of the piece card's `SectionIndex`.
 * Horizontal only. Each routed page mounts its own row, so there is no
 * instance for a marker to slide across: the active link draws its own bar.
 * The labels start on the column's edge, like the header above them.
 *
 * An item may carry a `count`: the section's own size, said once, on the tab.
 * @module shared/ui/composites/RouteTabs
 */

import React from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface RouteTabItem {
  readonly to: string;
  readonly label: string;
  /** Drawn by the `track` variant; `underline` is words alone. */
  readonly icon?: React.ReactNode;
  /** Active only on the exact path — for an index route. */
  readonly end?: boolean;
  readonly count?: number;
}

interface RouteTabsBaseProps {
  readonly items: readonly RouteTabItem[];
  readonly ariaLabel: string;
  readonly className?: string;
}

export type RouteTabsProps = RouteTabsBaseProps &
  (
    | { readonly variant?: "track"; readonly orientation?: "horizontal" | "vertical" }
    | { readonly variant: "underline" }
  );

const LINK_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40";

const UnderlineTabs = ({ items, ariaLabel, className }: RouteTabsBaseProps): React.JSX.Element => (
  <nav aria-label={ariaLabel} className={cn("min-w-0 border-b border-hairline", className)}>
    {/* Pulled out by the links' padding, so the first label starts on the
        column's edge and no focus ring is clipped by the scroller. */}
    <div className="no-scrollbar -mx-2 flex gap-1 overflow-x-auto">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2 transition-colors duration-200",
              LINK_FOCUS,
              isActive ? "text-ethereal-ink" : "text-ethereal-graphite hover:text-ethereal-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Text as="span" size="base" weight="medium" color="inherit" className="whitespace-nowrap">
                {item.label}
              </Text>
              {item.count !== undefined && (
                <Text as="span" size="sm" color="muted" className="tabular-nums">
                  {item.count}
                </Text>
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ethereal-ink transition-opacity duration-200",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);

const TrackTabs = ({
  items,
  ariaLabel,
  orientation = "horizontal",
  className,
}: RouteTabsBaseProps & { readonly orientation?: "horizontal" | "vertical" }): React.JSX.Element => {
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
              {item.icon && (
                <span
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-ethereal-gold" : "text-ethereal-graphite/50",
                  )}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
              )}
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

export const RouteTabs = (props: RouteTabsProps): React.JSX.Element =>
  props.variant === "underline" ? (
    <UnderlineTabs items={props.items} ariaLabel={props.ariaLabel} className={props.className} />
  ) : (
    <TrackTabs
      items={props.items}
      ariaLabel={props.ariaLabel}
      orientation={props.orientation}
      className={props.className}
    />
  );

RouteTabs.displayName = "RouteTabs";
