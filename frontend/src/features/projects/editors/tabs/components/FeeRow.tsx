/**
 * @file FeeRow.tsx
 * @description One person's fee in the budget ledger. The amount is a real
 * field, not a click-to-edit affordance — pricing a concert means typing
 * fifteen numbers in a row, and tabbing between them has to work — but it wears
 * the ghost fill, so a column of fifteen reads as figures rather than as
 * fifteen boxes.
 * A settled fee is money already paid: it is stated, not offered for editing.
 * The currency sits outside the field in both states, which is the only way the
 * amounts line up down the column when some rows are fields and some are text.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/FeeRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatLedgerAmount } from "../../../lib/money";
import type { LedgerEntry } from "../../hooks/useBudgetTab";

interface FeeRowProps {
  readonly entry: LedgerEntry;
  /** What the field shows: an edit, a pending standard rate, or what is stored. */
  readonly value: string;
  /** The draft differs from what is stored — the row is part of the save. */
  readonly isPending: boolean;
  readonly currencyLabel: string;
  readonly onChange: (value: string) => void;
}

export function FeeRow({
  entry,
  value,
  isPending,
  currencyLabel,
  onChange,
}: FeeRowProps): React.JSX.Element {
  const { t } = useTranslation();

  const settledLabel = t(
    "projects.budget.row.settled",
    "Rozliczone — stawki nie można już zmienić",
  );

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-5 py-1.5 transition-colors",
        isPending ? "bg-ethereal-gold/6" : "hover:bg-ethereal-ink/3",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" size="sm" weight="medium" truncate>
          {entry.name}
        </Text>
        {entry.meta && (
          <Caption as="span" color="muted" className="truncate">
            {entry.meta}
          </Caption>
        )}
      </span>

      {entry.isSettled ? (
        <span
          // Matches the height the field gives an editable row, so a ledger
          // holding both kinds still scans as one column.
          className="flex min-h-11 w-28 shrink-0 items-center justify-end gap-1.5"
          title={settledLabel}
        >
          <Check
            size={12}
            strokeWidth={3}
            className="shrink-0 text-ethereal-sage"
            aria-hidden="true"
          />
          <Text as="span" size="sm" color="sage" className="tabular-nums">
            {entry.fee === null ? "–" : formatLedgerAmount(entry.fee)}
          </Text>
          <span className="sr-only">{settledLabel}</span>
        </span>
      ) : (
        <span className="w-28 shrink-0">
          <Input
            // Not `type="number"`: a Polish keyboard types `400,50`, which a
            // native number field reports back as an empty value.
            type="text"
            inputMode="decimal"
            variant="ghost"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="–"
            aria-label={t("projects.budget.row.fee_aria", "Stawka — {{name}}", {
              name: entry.name,
            })}
            // The ghost fill carries no border width, so the field would be
            // invisible at rest — and a ledger has to invite typing. One
            // hairline under each amount is the affordance a column of figures
            // wants; fifteen full boxes is the wall this row replaced.
            className={cn(
              "border-b border-hairline-strong text-right tabular-nums",
              isPending && "bg-ethereal-gold/10",
            )}
          />
        </span>
      )}

      <Eyebrow size="overline-sm" color="muted" className="w-7 shrink-0">
        {currencyLabel}
      </Eyebrow>
    </li>
  );
}
