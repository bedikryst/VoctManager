/**
 * @file ArchiveStatLine.tsx
 * @description The one-line library summary under the archive page headers —
 * shared by the pieces list and the composers list, which previously typed the
 * same dot-separated `<strong>` markup twice.
 *
 * Facts only, in the sentence form the figures actually read in ("128 utworów ·
 * 71% z PDF"): these are inline counts, not display figures, so they are sans
 * and never `Metric`. Anything that is a call to action leaves the sentence and
 * becomes a real control in `action` — a gold underline pretending to be a
 * button is part of how this page ended up stating the review backlog three
 * times over.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveStatLine
 */

import React from "react";

import { Text } from "@/shared/ui/primitives/typography";

export interface ArchiveStat {
  readonly id: string;
  readonly value: React.ReactNode;
  readonly label: string;
}

interface ArchiveStatLineProps {
  readonly stats: readonly ArchiveStat[];
  /** A control, not a segment — rendered after the sentence. */
  readonly action?: React.ReactNode;
}

export const ArchiveStatLine = ({
  stats,
  action,
}: ArchiveStatLineProps): React.JSX.Element => (
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
