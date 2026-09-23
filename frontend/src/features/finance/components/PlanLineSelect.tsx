/**
 * @file PlanLineSelect.tsx
 * @description Which kosztorys line a cost is charged to. The caller passes
 * only the lines of the cost's own category — the server refuses any other —
 * and "outside the plan" is a real choice here, so it is offered as one.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/components/PlanLineSelect
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Select } from "@/shared/ui/primitives/Select";
import type { PlanLineDTO } from "../types/finance.dto";

interface PlanLineSelectProps {
  readonly lines: readonly PlanLineDTO[];
  /** A line id, or `""` for outside the plan. */
  readonly value: string;
  readonly onChange: (lineId: string) => void;
}

export function PlanLineSelect({ lines, value, onChange }: PlanLineSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const outside = t("finance.plan.outside", "Poza kosztorysem");

  return (
    <Select
      label={t("finance.plan.line_field", "Pozycja kosztorysu")}
      value={value}
      onValueChange={onChange}
      placeholder={outside}
      clearLabel={outside}
      options={lines.map((line) => ({ value: line.id, label: `${line.number} ${line.name}` }))}
    />
  );
}
