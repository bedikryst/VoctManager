/**
 * @file LedgerCard.tsx
 * @description One of the three ledgers on Honoraria — the cast, the crew, the
 * payees from outside both. A card, its optional standard-rate toolbar, and
 * its rows; the footer appears only when something on it is still unpriced,
 * because "0 bez stawki" on a finished ledger is the resting case in the
 * loudest slot the card has.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/LedgerCard
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

interface LedgerCardProps {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly rowCount: number;
  readonly unpricedCount: number;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly action?: React.ReactNode;
  readonly toolbar?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function LedgerCard({
  title,
  icon,
  rowCount,
  unpricedCount,
  emptyTitle,
  emptyDescription,
  action,
  toolbar,
  children,
}: LedgerCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const isEmpty = rowCount === 0;

  return (
    <SectionCard
      as="h2"
      scroll
      className="max-h-[60dvh]"
      bodyClassName="p-0 [scrollbar-gutter:stable]"
      icon={icon}
      title={title}
      action={
        action ??
        (!isEmpty ? (
          <Caption color="muted" className="tabular-nums">
            {t("finance.ledger.people", "{{count}} os.", { count: rowCount })}
          </Caption>
        ) : undefined)
      }
      toolbar={!isEmpty ? toolbar : undefined}
      footer={
        unpricedCount > 0 ? (
          <Eyebrow as="span" color="gold">
            {t("finance.ledger.unpriced", "Bez stawki: {{count}}", {
              count: unpricedCount,
            })}
          </Eyebrow>
        ) : undefined
      }
    >
      {isEmpty ? (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <ul className="divide-y divide-hairline pb-1">{children}</ul>
      )}
    </SectionCard>
  );
}
