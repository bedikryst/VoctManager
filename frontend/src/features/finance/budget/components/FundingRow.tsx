/**
 * @file FundingRow.tsx
 * @description One source on the project: its name, what kind of money it is
 * and where its decision stands, what the project expects of it, and — once
 * they exist — what has arrived and what is charged to it. The warnings the
 * server raised about this source are spoken on the row, in their own tone;
 * a source with nothing wrong says nothing more.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/FundingRow
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  SEVERITY_TEXT,
  fundingKindLabel,
  fundingStatusLabel,
  warningTitle,
} from "../../lib/financePresentation";
import { formatLedgerAmount, isPositiveAmount } from "../../lib/money";
import type { BudgetWarningDTO, ProjectFundingDTO } from "../../types/finance.dto";

interface FundingRowProps {
  readonly funding: ProjectFundingDTO;
  readonly warnings: readonly BudgetWarningDTO[];
  readonly isFocused: boolean;
  /** `null` when the source takes no act now; its slot stays, so figures align. */
  readonly menu: React.ReactNode;
}

export function FundingRow({
  funding,
  warnings,
  isFocused,
  menu,
}: FundingRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const currency = t("common.currency", "PLN");
  const { source } = funding;
  // The resting state of a source nobody has applied to yet says nothing.
  const facts = [
    fundingKindLabel(t, source.kind),
    source.status === "PLANNED" ? null : fundingStatusLabel(t, source.status),
    source.grantor || null,
  ].filter(Boolean);

  return (
    <li
      id={`funding-${funding.id}`}
      className={cn(
        "flex scroll-mt-24 items-start gap-3 px-5 py-3 transition-colors hover:bg-ethereal-ink/3",
        isFocused && "bg-ethereal-gold/10 ring-1 ring-inset ring-ethereal-gold/40",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text as="span" size="sm" weight="medium" truncate>
          {source.name}
        </Text>
        <Caption as="span" color="muted" className="truncate">
          {facts.join(" · ")}
        </Caption>
        {warnings.map((warning) => (
          <Caption key={warning.code} as="span" color={SEVERITY_TEXT[warning.severity]}>
            {warningTitle(t, warning)}
          </Caption>
        ))}
      </span>

      <span className="flex w-36 shrink-0 flex-col items-end">
        <Text as="span" size="sm" className="tabular-nums">
          {formatLedgerAmount(funding.planned_amount) ?? "0"}
        </Text>
        {isPositiveAmount(funding.received_amount) && (
          <Caption as="span" color="muted" className="tabular-nums">
            {t("finance.funding.received_caption", "wpłynęło {{amount}}", {
              amount: formatLedgerAmount(funding.received_amount) ?? "0",
            })}
          </Caption>
        )}
        {(funding.charged_count > 0 || isPositiveAmount(funding.charged)) && (
          <Caption
            as="span"
            color={funding.over_charge_limit ? "gold" : "muted"}
            className="tabular-nums"
          >
            {t("finance.funding.charged_caption", "obciążono {{amount}}", {
              amount: formatLedgerAmount(funding.charged) ?? "0",
            })}
          </Caption>
        )}
        {isPositiveAmount(funding.line_allocated) && (
          <Caption
            as="span"
            color={funding.over_plan_allocation ? "gold" : "muted"}
            className="tabular-nums"
          >
            {t("finance.funding.plan_caption", "w kosztorysie {{amount}}", {
              amount: formatLedgerAmount(funding.line_allocated) ?? "0",
            })}
          </Caption>
        )}
      </span>

      <Eyebrow size="overline-sm" color="muted" className="w-7 shrink-0 pt-1">
        {currency}
      </Eyebrow>

      {menu ?? <span className="w-7 shrink-0 pointer-coarse:w-9" aria-hidden="true" />}
    </li>
  );
}
