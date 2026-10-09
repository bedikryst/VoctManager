/**
 * @file PlanBudget.tsx
 * @description The plan's minutes against the evening's length, in the plan's
 * header: "95 / 165 min", gold once the main part claims more than the
 * evening has. An untimed evening gets the planned minutes alone, and a plan
 * with neither minutes nor clocks to imply them gets nothing — no budget is
 * stated where none was made.
 * The same figure in the read view and the editor, so a save changes nothing
 * about how it reads.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/PlanBudget
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Caption } from "@/shared/ui/primitives/typography";

interface PlanBudgetProps {
  /**
   * The main rows' lengths (`plannedMinutes` over `rowLengths`, so clocks
   * alone state a budget too); null when no row has a length.
   */
  readonly planned: number | null;
  /** The evening's length in minutes; null when it was never timed. */
  readonly length: number | null;
}

export const PlanBudget = ({ planned, length }: PlanBudgetProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (planned === null) return null;

  if (length === null || length <= 0) {
    return (
      <Caption
        color="muted"
        className="tabular-nums"
        title={t("rehearsals.plan.block.planned", "zaplanowano {{minutes}} min", {
          minutes: planned,
        })}
      >
        {t("rehearsals.plan.block.length", "{{minutes}} min", { minutes: planned })}
      </Caption>
    );
  }

  return (
    <Caption
      color={planned > length ? "gold" : "muted"}
      className="tabular-nums"
      title={t("rehearsals.plan.budget.label", "Zaplanowano {{planned}} z {{length}} min", {
        planned,
        length,
      })}
    >
      {t("rehearsals.plan.budget.of", "{{planned}} / {{length}} min", { planned, length })}
    </Caption>
  );
};
