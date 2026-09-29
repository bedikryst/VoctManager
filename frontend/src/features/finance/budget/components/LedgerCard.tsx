/**
 * @file LedgerCard.tsx
 * @description One of the three ledgers on Honoraria — the cast, the crew, the
 * payees from outside both. A card, its optional standard-rate toolbar, the
 * checkbox that selects every row it can, and its rows. The select-all sits in
 * the rows' own checkbox column, under the toolbar, so it reads as the head of
 * that column rather than as part of the rate beside it. The footer appears
 * only when it has something to say: rows still unpriced — "0 bez stawki" on a
 * finished ledger is the resting case in the loudest slot the card has — or
 * which sources carry the section, which otherwise lives only in row menus.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/LedgerCard
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

export interface LedgerSelectAll {
  /** Selected rows of this section. */
  readonly selected: number;
  /** Rows of this section a bulk act can reach. */
  readonly total: number;
  readonly onToggle: () => void;
}

interface LedgerCardProps {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly rowCount: number;
  readonly unpricedCount: number;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly action?: React.ReactNode;
  readonly toolbar?: React.ReactNode;
  /** Absent, or with nothing to select, draws no select-all. */
  readonly selectAll?: LedgerSelectAll;
  /** Which sources carry the section, as one line. */
  readonly fundingNote?: string;
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
  selectAll,
  fundingNote,
  children,
}: LedgerCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const isEmpty = rowCount === 0;
  const hasSelectAll = !isEmpty && selectAll !== undefined && selectAll.total > 0;
  const allSelected = hasSelectAll && selectAll.selected === selectAll.total;

  const selectAllRow = hasSelectAll ? (
    <label className="flex w-fit cursor-pointer items-center gap-3 py-1">
      <span className="flex w-4 shrink-0 justify-center">
        <Checkbox
          checked={allSelected}
          indeterminate={selectAll.selected > 0 && !allSelected}
          onChange={selectAll.onToggle}
        />
      </span>
      <Caption as="span" color="muted">
        {allSelected
          ? t("finance.ledger.deselect_all", "Odznacz wszystkich")
          : t("finance.ledger.select_all", "Zaznacz wszystkich ({{count}})", {
              count: selectAll.total,
            })}
      </Caption>
    </label>
  ) : null;

  const hasFooter = unpricedCount > 0 || Boolean(fundingNote);

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
      toolbar={
        !isEmpty && (toolbar || selectAllRow) ? (
          <div className="flex flex-col gap-3">
            {toolbar}
            {selectAllRow}
          </div>
        ) : undefined
      }
      footer={
        hasFooter ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {unpricedCount > 0 && (
              <Eyebrow as="span" color="gold">
                {t("finance.ledger.unpriced", "Bez stawki: {{count}}", {
                  count: unpricedCount,
                })}
              </Eyebrow>
            )}
            {fundingNote && (
              <Caption as="span" color="muted" className="tabular-nums">
                {fundingNote}
              </Caption>
            )}
          </div>
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
