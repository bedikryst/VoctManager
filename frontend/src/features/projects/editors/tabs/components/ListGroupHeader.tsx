/**
 * @file ListGroupHeader.tsx
 * @description The sticky divider inside a scrolling picker column — a voice
 * section in the cast, a specialty in the crew base. It is what lets a column
 * be read as a roster rather than as one long list, and it stays legible while
 * the body scrolls under it.
 * Shared by every two-pane transfer board in the hub, because a second copy of
 * a recipe is how the panel drifted into sixteen letter-spacings in the first
 * place.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/ListGroupHeader
 */

import React from "react";

import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface ListGroupHeaderProps {
  readonly label: string;
  readonly count: number;
  /**
   * Optional glyph for the group. It carries the gold of `SectionCard`'s own
   * icon slot rather than a per-group accent: six tinted headers in one column
   * is the bucket-shouting the divisi board had to unlearn.
   */
  readonly icon?: React.ReactNode;
}

export function ListGroupHeader({
  label,
  count,
  icon,
}: ListGroupHeaderProps): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hairline bg-ethereal-alabaster/92 px-5 py-1.5 backdrop-blur-sm">
      <span className="flex min-w-0 items-center gap-1.5">
        {icon && (
          <span className="shrink-0 text-ethereal-gold/70" aria-hidden="true">
            {icon}
          </span>
        )}
        <Eyebrow size="overline-sm" color="muted" className="truncate">
          {label}
        </Eyebrow>
      </span>
      <Text as="span" size="xs" color="muted" className="tabular-nums">
        {count}
      </Text>
    </div>
  );
}
