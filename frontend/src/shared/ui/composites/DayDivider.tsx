/**
 * @file DayDivider.tsx
 * @description Centred day-group separator for vertical feeds (message streams,
 * schedule timeline). Two hairlines and the day itself between them.
 *
 * The date is content that owns its casing ("dziś", "12 marca"), so the pill is
 * a `natural` `Badge` rather than the machine-label overline — and rather than
 * the private `rounded-full` chip it used to draw, which was the shape `Badge`
 * exists to prevent.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DayDivider
 */

import React from "react";

import { Badge } from "@/shared/ui/primitives/Badge";

interface DayDividerProps {
  label: string;
}

export const DayDivider: React.FC<DayDividerProps> = ({ label }) => (
  <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
    {/* A 1px rule drawn as a background is still a 1px rule: it takes the
        hairline token like every other one in an in-flow surface. */}
    <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
    <Badge casing="natural" variant="neutral">
      {label}
    </Badge>
    <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
  </div>
);
