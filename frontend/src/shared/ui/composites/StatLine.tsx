/**
 * @file StatLine.tsx
 * @description The dot-separated facts line under a page or card header —
 * "128 utworów · 71% z PDF", "40 śpiewaków · 12 prób".
 *
 * Facts only, in the sentence form the figures actually read in: these are
 * inline counts, not display figures, so they are sans and never `Metric`.
 * Anything that is a call to action leaves the sentence and becomes a real
 * control in `action` — a gold underline pretending to be a button is part of
 * how the archive list ended up stating its review backlog four times over.
 *
 * Sibling figures on one line share one denominator, or they are not siblings:
 * a segment counted over a filtered set beside two counted over the library is
 * the defect this shape makes easy to ship.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/StatLine
 */

import React from "react";

import { Text } from "@/shared/ui/primitives/typography";

export interface StatLineItem {
  readonly id: string;
  readonly value: React.ReactNode;
  readonly label: string;
}

interface StatLineProps {
  readonly stats: readonly StatLineItem[];
  /** A control, not a segment — rendered after the sentence. */
  readonly action?: React.ReactNode;
}

export const StatLine = ({
  stats,
  action,
}: StatLineProps): React.JSX.Element => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
    {stats.map((stat, index) => (
      <React.Fragment key={stat.id}>
        {index > 0 && (
          <Text as="span" size="sm" color="muted" aria-hidden="true">
            ·
          </Text>
        )}
        <Text as="span" size="sm" color="graphite">
          <Text as="strong" size="sm" weight="semibold" color="default">
            {stat.value}
          </Text>{" "}
          {stat.label}
        </Text>
      </React.Fragment>
    ))}
    {action}
  </div>
);
