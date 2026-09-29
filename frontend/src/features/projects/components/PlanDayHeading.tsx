/**
 * @file PlanDayHeading.tsx
 * @description The heading that opens one day of a trip's plan, in the editor
 * and on the Overview card alike. It forks off the plan's spine — a tick from
 * the line, the date, a hairline to the edge — so a day reads as a division of
 * the list rather than as one more row in it.
 * The date is words in the body face, never an overline: the fixed stops under
 * it (the call, the concert) already speak in overlines, and a heading in their
 * voice cannot be told from a row. Concert day is gold, as the one day the
 * whole plan points at.
 * Callers render it inside a spine list whose rows sit `pl-5` from the line.
 * @module features/projects/components/PlanDayHeading
 */

import React from "react";

import { Text } from "@/shared/ui/primitives/typography";

interface PlanDayHeadingProps {
  readonly label: string;
  readonly isEventDay: boolean;
}

export const PlanDayHeading = ({
  label,
  isEventDay,
}: PlanDayHeadingProps): React.JSX.Element => (
  <div className="relative flex items-center gap-3">
    <span
      className="absolute -left-5 top-1/2 h-px w-4 bg-hairline-strong"
      aria-hidden="true"
    />
    {/* Intl writes Polish and French weekdays in lower case; a heading
        starts with a capital in all three languages. */}
    <Text
      as="h3"
      weight="semibold"
      color={isEventDay ? "gold" : "default"}
      className="first-letter:uppercase"
    >
      {label}
    </Text>
    <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
  </div>
);
