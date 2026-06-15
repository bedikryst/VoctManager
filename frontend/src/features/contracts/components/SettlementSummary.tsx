/**
 * @file SettlementSummary.tsx
 * @description Scope-aware money panel for the settlements cockpit. Leads with the
 * single number a conductor cares about — what is still owed — then breaks it down
 * into committed budget and two coverage rails (priced / paid). Reused for both the
 * whole portfolio and a single selected project.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/SettlementSummary
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Coins, Wallet } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Caption,
  Eyebrow,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import type { SettlementSummaryData } from "../hooks/useContractsData";
import {
  formatContractCurrency,
  formatInteger,
} from "../lib/contractsPresentation";

interface SettlementSummaryProps {
  summary: SettlementSummaryData;
  scopeLabel: string;
}

const CoverageRail = ({
  label,
  done,
  total,
  rate,
  accent,
}: {
  label: string;
  done: number;
  total: number;
  rate: number;
  accent: "gold" | "sage";
}): React.JSX.Element => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <Caption color="muted">{label}</Caption>
      <Caption color="muted" className="tabular-nums">
        <Text as="span" size="xs" weight="semibold" className="text-ethereal-ink">
          {formatInteger(done)}
        </Text>
        {" / "}
        {formatInteger(total)}
      </Caption>
    </div>
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          accent === "gold" ? "bg-ethereal-gold/70" : "bg-ethereal-sage/70",
        )}
        style={{ width: `${rate}%` }}
      />
    </div>
  </div>
);

export const SettlementSummary = React.memo(
  ({ summary, scopeLabel }: SettlementSummaryProps): React.JSX.Element => {
    const { t } = useTranslation();
    const hasDebt = summary.outstanding > 0;
    const isClear = !hasDebt && summary.missingCount === 0;

    return (
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        {/* Hero: outstanding liability */}
        <div className="border-b border-ethereal-ink/6 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                isClear
                  ? "text-ethereal-sage"
                  : hasDebt
                    ? "text-ethereal-crimson/80"
                    : "text-ethereal-gold/80",
              )}
              aria-hidden="true"
            >
              {isClear ? <CheckCircle2 size={14} /> : <Coins size={14} />}
            </span>
            <Eyebrow color="muted">
              {t("contracts.summary.outstanding", "Do zapłaty")}
            </Eyebrow>
            <Caption color="muted" className="ml-auto truncate">
              {scopeLabel}
            </Caption>
          </div>

          <Metric
            size="2xl"
            color={isClear ? "sage" : hasDebt ? "crimson" : "gold"}
            className="tabular-nums leading-none"
          >
            {isClear
              ? t("contracts.summary.all_settled", "Rozliczono")
              : formatContractCurrency(summary.outstanding)}
          </Metric>

          <Caption color="muted" className="mt-2 block">
            {summary.missingCount > 0
              ? t(
                  "contracts.summary.outstanding_note_missing",
                  "{{owed}} osób oczekuje na wypłatę · {{missing}} bez wyceny",
                  {
                    owed: formatInteger(summary.outstandingCount),
                    missing: formatInteger(summary.missingCount),
                  },
                )
              : isClear
                ? t(
                    "contracts.summary.all_settled_note",
                    "Wszystkie honoraria w tym zakresie są rozliczone.",
                  )
                : t(
                    "contracts.summary.outstanding_note",
                    "Oczekujących wypłat: {{n}}",
                    { n: summary.outstandingCount },
                  )}
          </Caption>
        </div>

        {/* Committed budget + coverage rails */}
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet
                size={14}
                className="text-ethereal-gold/70"
                aria-hidden="true"
              />
              <Eyebrow color="muted">
                {t("contracts.summary.committed", "Budżet honorariów")}
              </Eyebrow>
            </div>
            <Text size="sm" weight="semibold" className="tabular-nums">
              {formatContractCurrency(summary.committed)}
            </Text>
          </div>

          <CoverageRail
            label={t("contracts.summary.priced", "Wycenione")}
            done={summary.pricedCount}
            total={summary.billableCount}
            rate={summary.pricedRate}
            accent="gold"
          />
          <CoverageRail
            label={t("contracts.summary.paid", "Zapłacone")}
            done={summary.paidCount}
            total={summary.pricedCount}
            rate={summary.paidRate}
            accent="sage"
          />
        </div>
      </GlassCard>
    );
  },
);

SettlementSummary.displayName = "SettlementSummary";
