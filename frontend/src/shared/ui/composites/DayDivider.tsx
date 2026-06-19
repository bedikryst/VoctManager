/**
 * @file DayDivider.tsx
 * @description Centred day-group separator for vertical feeds (message streams,
 * schedule timeline). A quiet hairline with a centred pill — keeps long lists
 * legible without shouting.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DayDivider
 */

import React from "react";

import { Label } from "@/shared/ui/primitives/typography";

interface DayDividerProps {
  label: string;
}

export const DayDivider: React.FC<DayDividerProps> = ({ label }) => (
  <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
    <span className="h-px flex-1 bg-ethereal-ink/8" aria-hidden="true" />
    <Label
      size="xs"
      color="muted"
      weight="medium"
      className="rounded-full border border-ethereal-ink/8 bg-ethereal-alabaster/70 px-2.5 py-0.5"
    >
      {label}
    </Label>
    <span className="h-px flex-1 bg-ethereal-ink/8" aria-hidden="true" />
  </div>
);
