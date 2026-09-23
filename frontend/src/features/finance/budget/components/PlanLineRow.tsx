/**
 * @file PlanLineRow.tsx
 * @description One kosztorys line: its number, its name and how it is built
 * (quantity × unit cost), the sources the plan splits it between, the planned
 * amount, and what has actually been charged to it. The actual stays silent
 * until something is charged; a line past the overrun its sources tolerate
 * says so in gold — work the manager has to look at — and a line over its plan
 * but within that tolerance says it is within it.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/PlanLineRow
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatPercent, formatQuantity, unitShortLabel } from "../../lib/financePresentation";
import { formatLedgerAmount, isPositiveAmount } from "../../lib/money";
import type { PlanLineDTO } from "../../types/finance.dto";

interface PlanLineRowProps {
  readonly line: PlanLineDTO;
  /** The plan's split between sources as one line; empty when there is none. */
  readonly sources: string;
  readonly isFocused: boolean;
  /** `null` when the line takes no act now; its slot stays, so figures align. */
  readonly menu: React.ReactNode;
}

export function PlanLineRow({ line, sources, isFocused, menu }: PlanLineRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const currency = t("common.currency", "PLN");
  const charged = line.cost_count > 0 || isPositiveAmount(line.actual);
  const withinTolerance = line.over_plan && !line.over_tolerance;

  return (
    <li
      id={`plan-line-${line.id}`}
      className={cn(
        "flex scroll-mt-24 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ethereal-ink/3",
        isFocused && "bg-ethereal-gold/10 ring-1 ring-inset ring-ethereal-gold/40",
      )}
    >
      <Text as="span" size="sm" color="muted" className="w-9 shrink-0 tabular-nums">
        {line.number}
      </Text>

      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" size="sm" weight="medium" truncate>
          {line.name}
        </Text>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <Caption as="span" color="muted" className="tabular-nums">
            {t("finance.plan.formula", "{{quantity}} {{unit}} × {{cost}} {{currency}}", {
              quantity: formatQuantity(line.quantity),
              unit: unitShortLabel(t, line.unit),
              cost: formatLedgerAmount(line.unit_cost) ?? "0",
              currency,
            })}
          </Caption>
          {line.note && (
            <>
              <Caption as="span" color="muted" aria-hidden="true">
                ·
              </Caption>
              <Caption as="span" color="muted" className="truncate">
                {line.note}
              </Caption>
            </>
          )}
        </span>
        {sources && (
          <Caption as="span" color="muted" className="truncate tabular-nums">
            {t("finance.plan.sources", "Źródła: {{sources}}", { sources })}
          </Caption>
        )}
      </span>

      <span className="flex w-32 shrink-0 flex-col items-end">
        <Text as="span" size="sm" className="tabular-nums">
          {formatLedgerAmount(line.planned_amount) ?? "0"}
        </Text>
        {charged && (
          <Caption
            as="span"
            color={line.over_tolerance ? "gold" : "muted"}
            className="tabular-nums"
          >
            {t("finance.plan.actual", "wykonanie {{amount}}", {
              amount: formatLedgerAmount(line.actual) ?? "0",
            })}
          </Caption>
        )}
        {withinTolerance && (
          <Caption as="span" color="muted" className="tabular-nums">
            {t("finance.plan.within_tolerance", "w tolerancji {{pct}}", {
              pct: formatPercent(line.tolerance_pct),
            })}
          </Caption>
        )}
      </span>

      <Eyebrow size="overline-sm" color="muted" className="w-7 shrink-0">
        {currency}
      </Eyebrow>

      {menu ?? <span className="w-7 shrink-0 pointer-coarse:w-9" aria-hidden="true" />}
    </li>
  );
}
