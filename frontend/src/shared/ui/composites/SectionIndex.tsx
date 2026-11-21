/**
 * @file SectionIndex.tsx
 * @description The in-page index of a long document: one row of links to its
 * sections, meant to stick to the top of the document's scroller. It scrolls
 * sideways when the row is wider than its column, keeping the current section
 * in view, and lights that section with a marker that slides under it
 * (transform only). A section may carry a count of outstanding work. An edge
 * with links beyond it fades and carries a chevron, so the sections out of
 * sight are signalled even when the row happens to end between two labels; the
 * chevron scrolls the row by most of its width. The row's end can hold an
 * action that stays reachable once the page's header has scrolled away.
 *
 * The caller says which section is current (`useScrollSpy`) and scrolls to a
 * chosen one; the index only renders and reports the choice.
 * @module shared/ui/composites/SectionIndex
 */

import React, { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

export interface SectionIndexItem {
  readonly id: string;
  readonly label: string;
  /** Work outstanding in the section; omitted or 0 shows nothing. */
  readonly count?: number;
  /** What the count means, read out in place of the bare number. */
  readonly countLabel?: string;
}

interface SectionIndexProps {
  readonly items: readonly SectionIndexItem[];
  readonly activeId: string | null;
  readonly onSelect: (id: string) => void;
  readonly ariaLabel: string;
  /** Held at the row's right end, outside the part that scrolls sideways. */
  readonly trailing?: ReactNode;
  readonly className?: string;
  /** Sizes the links, as when the row has to line up with a neighbouring band. */
  readonly linkClassName?: string;
}

interface MarkerBox {
  readonly left: number;
  readonly width: number;
}

interface HiddenEdges {
  readonly start: boolean;
  readonly end: boolean;
}

/** Slack for subpixel scroll positions. */
const EDGE_SLACK_PX = 1;

/** Share of the row's width one chevron press scrolls, leaving a label of context. */
const PAGE_SHARE = 0.7;

/**
 * A pointer shortcut over a faded edge. Hidden from the keyboard and from
 * assistive tech, which reach every link in order anyway.
 */
const EdgeChevron = ({ side, onPress }: { side: "start" | "end"; onPress: () => void }) => (
  <button
    type="button"
    tabIndex={-1}
    aria-hidden="true"
    onClick={onPress}
    className={cn(
      "absolute inset-y-0 z-10 flex w-7 items-center text-ethereal-graphite transition-colors hover:text-ethereal-ink",
      side === "start" ? "left-0 justify-start" : "right-0 justify-end",
    )}
  >
    {side === "start" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
  </button>
);

export const SectionIndex = ({
  items,
  activeId,
  onSelect,
  ariaLabel,
  trailing,
  className,
  linkClassName,
}: SectionIndexProps): React.JSX.Element => {
  const rowRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [marker, setMarker] = useState<MarkerBox | null>(null);
  const [hidden, setHidden] = useState<HiddenEdges>({ start: false, end: false });

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const place = (): void => {
      const link = activeId ? linkRefs.current.get(activeId) : undefined;
      if (!link) {
        setMarker(null);
        return;
      }
      const next = { left: link.offsetLeft, width: link.offsetWidth };
      setMarker((prev) => (prev?.left === next.left && prev.width === next.width ? prev : next));
      // Sideways only: scrollIntoView would also move the page under the index.
      const start = link.offsetLeft;
      const end = start + link.offsetWidth;
      if (start < row.scrollLeft) row.scrollTo({ left: start });
      else if (end > row.scrollLeft + row.clientWidth) row.scrollTo({ left: end - row.clientWidth });
    };
    const measureEdges = (): void => {
      const start = row.scrollLeft > EDGE_SLACK_PX;
      const end = row.scrollLeft + row.clientWidth < row.scrollWidth - EDGE_SLACK_PX;
      setHidden((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const update = (): void => {
      place();
      measureEdges();
    };
    update();
    row.addEventListener("scroll", measureEdges, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(row);
    return () => {
      row.removeEventListener("scroll", measureEdges);
      observer?.disconnect();
    };
  }, [activeId, items]);

  const scrollPage = (direction: 1 | -1): void => {
    const row = rowRef.current;
    if (!row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * row.clientWidth * PAGE_SHARE, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <nav aria-label={ariaLabel} className={cn("flex min-w-0 items-center gap-3", className)}>
      {/* Pulled out by the links' padding, so the first label starts on the
          column's edge like the text under it. */}
      <div className="relative -ml-2 min-w-0 flex-1">
        {hidden.start && <EdgeChevron side="start" onPress={() => scrollPage(-1)} />}
        {hidden.end && <EdgeChevron side="end" onPress={() => scrollPage(1)} />}
        <div
          ref={rowRef}
          className={cn(
            "no-scrollbar relative overflow-x-auto",
            hidden.start && "mask-l-from-80%",
            hidden.end && "mask-r-from-75%",
          )}
        >
          <div className="flex w-max items-stretch gap-1">
            {items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <a
                  key={item.id}
                  ref={(node) => {
                    if (node) linkRefs.current.set(item.id, node);
                    else linkRefs.current.delete(item.id);
                  }}
                  href={`#${item.id}`}
                  aria-current={isActive ? "location" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onSelect(item.id);
                  }}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2 transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40",
                    isActive
                      ? "text-ethereal-ink"
                      : "text-ethereal-graphite hover:text-ethereal-ink",
                    linkClassName,
                  )}
                >
                  <Text as="span" size="base" weight="medium" color="inherit" className="whitespace-nowrap">
                    {item.label}
                  </Text>
                  {item.count ? (
                    <>
                      <Text as="span" size="sm" weight="semibold" color="amethyst" className="tabular-nums" aria-hidden="true">
                        {item.count}
                      </Text>
                      {item.countLabel && <Text as="span" className="sr-only">{item.countLabel}</Text>}
                    </>
                  ) : null}
                </a>
              );
            })}
          </div>
          {/* One pixel wide, stretched to the link: the slide and the resize
              are both a transform, so the compositor runs them. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left rounded-full bg-ethereal-ink transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
              marker ? "opacity-100" : "opacity-0",
            )}
            style={marker ? { transform: `translateX(${marker.left}px) scaleX(${marker.width})` } : undefined}
          />
        </div>
      </div>
      {trailing}
    </nav>
  );
};
