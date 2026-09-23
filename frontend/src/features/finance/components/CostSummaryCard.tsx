/**
 * @file CostSummaryCard.tsx
 * @description What the concert costs, as one headline figure, and the rail of
 * facts that qualify it. The headline never changes meaning under the reader:
 * it is always the cost. What qualifies it — how much has already left the
 * account, how much is still unpriced — rides the rail, and a fact that has not
 * happened yet ("0 zapłacone" before any payment) takes no slot at all.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/components/CostSummaryCard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Wallet } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Caption, Eyebrow, Metric, Unit } from "@/shared/ui/primitives/typography";

export type FigureTone = "default" | "gold" | "sage";

export interface CostFigure {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly tone: FigureTone;
}

interface CostSummaryCardProps {
  readonly title: string;
  readonly headlineLabel: string;
  readonly headline: string;
  readonly figures: readonly CostFigure[];
  /** One line under the headline — e.g. that the figures preview a draft. */
  readonly note?: string;
  readonly action?: React.ReactNode;
}

export function CostSummaryCard({
  title,
  headlineLabel,
  headline,
  figures,
  note,
  action,
}: CostSummaryCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const currency = t("common.currency", "PLN");

  return (
    <SectionCard
      as="h2"
      icon={<Wallet size={15} aria-hidden="true" />}
      title={title}
      action={action}
      bodyClassName="gap-5"
    >
      <div className="flex flex-col gap-1">
        <Eyebrow color="muted">{headlineLabel}</Eyebrow>
        <span className="flex items-baseline gap-2">
          <Metric>{headline}</Metric>
          <Unit>{currency}</Unit>
        </span>
        {note && <Caption color="gold">{note}</Caption>}
      </div>

      {figures.length > 0 && (
        <div className="flex flex-wrap gap-x-10 gap-y-4 border-t border-hairline pt-4">
          {figures.map((figure) => (
            <div key={figure.key} className="flex flex-col gap-1.5">
              <Eyebrow size="overline-sm" color="muted">
                {figure.label}
              </Eyebrow>
              <span className="flex items-baseline gap-1.5">
                <Metric as="span" color={figure.tone} className="text-2xl leading-none">
                  {figure.value}
                </Metric>
                {figure.unit && (
                  <Unit color={figure.tone === "default" ? "muted" : figure.tone}>
                    {figure.unit}
                  </Unit>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
