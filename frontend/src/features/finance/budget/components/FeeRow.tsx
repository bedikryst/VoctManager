/**
 * @file FeeRow.tsx
 * @description One person's fee in the Honoraria ledger.
 * The amount is a real field while nothing has settled it — pricing a concert
 * is typing fifteen numbers in a row, and tabbing between them has to work —
 * in the ghost fill, so a column of fifteen reads as figures, not boxes. Once a
 * payment or a contract has settled it, the amount is stated instead.
 * The resting default says nothing: the form the row would get anyway shows no
 * chip; a contract prints its number once issued; "unpaid" and "unsigned" are
 * silent until the concert has passed, and only then turn into gold work.
 * The currency sits outside the field in every state, which is the only way
 * the amounts line up when some rows are fields and some are text.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/FeeRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Lock } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { RowPreview } from "../../lib/feeDraft";
import { isPriceEditable } from "../../lib/feeDraft";
import {
  exceptionalForm,
  formatFinanceDate,
  formShortLabel,
} from "../../lib/financePresentation";
import { formatLedgerAmount } from "../../lib/money";
import type { LedgerRowDTO } from "../../types/finance.dto";

type CaptionTone = "muted" | "gold" | "sage" | "crimson";

interface RowFact {
  readonly key: string;
  readonly text: string;
  readonly tone: CaptionTone;
}

interface FeeRowProps {
  readonly row: LedgerRowDTO;
  readonly preview: RowPreview;
  readonly concertPassed: boolean;
  /** Reached from a warning on Przegląd: the row the reader came to see. */
  readonly isFocused: boolean;
  /** `null` when the row takes no bulk act, so it draws no checkbox at all. */
  readonly selection: {
    readonly selected: boolean;
    readonly onToggle: () => void;
  } | null;
  readonly onAmountChange: (value: string) => void;
  readonly menu: React.ReactNode;
}

export function FeeRow({
  row,
  preview,
  concertPassed,
  isFocused,
  selection,
  onAmountChange,
  menu,
}: FeeRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const currency = t("common.currency", "PLN");
  const editable = isPriceEditable(row);
  const chipForm = exceptionalForm(row, preview.next.form);
  const contract = row.contract;

  const facts: RowFact[] = [];
  if (row.payee_role) {
    facts.push({ key: "role", text: row.payee_role, tone: "muted" });
  }
  if (row.is_paid && row.origin === "cast" && row.seat_status === "DEC") {
    facts.push({
      key: "declined",
      text: t("finance.row.paid_for_declined", "odmowa udziału — wypłacone"),
      tone: "crimson",
    });
  }
  if (row.orphaned) {
    facts.push({
      key: "orphaned",
      text: t("finance.row.orphaned", "poza obsadą — nie wlicza się do kosztu"),
      tone: "gold",
    });
  }
  if (contract) {
    facts.push({ key: "contract", text: contract.number, tone: "muted" });
    if (contract.status === "SIGNED") {
      facts.push({ key: "signed", text: t("finance.row.signed", "podpisana"), tone: "muted" });
    } else if (concertPassed) {
      facts.push({ key: "unsigned", text: t("finance.row.unsigned", "niepodpisana"), tone: "gold" });
    }
  }
  if (row.paid_on) {
    facts.push({
      key: "paid",
      text: t("finance.row.paid_on", "wypłacone {{date}}", {
        date: formatFinanceDate(row.paid_on, i18n.language),
      }),
      tone: "sage",
    });
  } else if (
    concertPassed &&
    row.counted &&
    row.form !== "VOLUNTEER" &&
    !row.orphaned
  ) {
    facts.push({ key: "unpaid", text: t("finance.row.unpaid", "niewypłacone"), tone: "gold" });
  }

  const stated = formatLedgerAmount(row.contract_amount);
  const lockedTitle = contract
    ? t("finance.row.locked_by_contract", "Kwota zamrożona umową {{number}}", {
        number: contract.number,
      })
    : undefined;

  return (
    <li
      id={`fee-row-${row.key}`}
      className={cn(
        "flex scroll-mt-24 items-center gap-3 px-5 py-1.5 transition-colors",
        preview.isPending ? "bg-ethereal-gold/6" : "hover:bg-ethereal-ink/3",
        isFocused && "bg-ethereal-gold/10 ring-1 ring-inset ring-ethereal-gold/40",
      )}
    >
      <span className="flex w-4 shrink-0 justify-center">
        {selection && (
          <Checkbox
            checked={selection.selected}
            onChange={selection.onToggle}
            aria-label={t("finance.row.select_aria", "Zaznacz — {{name}}", {
              name: row.payee_name,
            })}
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" size="sm" weight="medium" truncate>
          {row.payee_name ||
            t("finance.row.unknown_payee", "Osoba bez nazwiska")}
        </Text>
        {facts.length > 0 && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
            {facts.map((fact, index) => (
              <React.Fragment key={fact.key}>
                {index > 0 && (
                  <Caption as="span" color="muted" aria-hidden="true">
                    ·
                  </Caption>
                )}
                <Caption as="span" color={fact.tone} className="truncate">
                  {fact.text}
                </Caption>
              </React.Fragment>
            ))}
          </span>
        )}
      </span>

      {chipForm && (
        <Badge
          variant={chipForm === "VOLUNTEER" ? "incense" : "neutral"}
          className="hidden shrink-0 sm:inline-flex"
        >
          {formShortLabel(t, chipForm)}
        </Badge>
      )}

      {editable ? (
        <span className="w-28 shrink-0">
          <Input
            // Not `type="number"`: a Polish keyboard types `400,50`, which a
            // native number field reports back as an empty value.
            type="text"
            inputMode="decimal"
            variant="ghost"
            value={preview.amountInput}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="–"
            hasError={preview.isInvalid}
            aria-label={t("finance.row.amount_aria", "Kwota — {{name}}", {
              name: row.payee_name,
            })}
            // The ghost fill has no border, so at rest the field would be
            // invisible — and a ledger has to invite typing. One hairline under
            // each amount is the affordance a column of figures wants.
            className={cn(
              "border-b border-hairline-strong text-right tabular-nums",
              preview.isPending && "bg-ethereal-gold/10",
            )}
          />
        </span>
      ) : (
        <span
          // The height an editable row's field gives it, so a ledger holding
          // both kinds still scans as one column.
          className="flex min-h-11 w-28 shrink-0 items-center justify-end gap-1.5"
          title={lockedTitle}
        >
          {row.is_paid ? (
            <Check
              size={12}
              strokeWidth={3}
              className="shrink-0 text-ethereal-sage"
              aria-hidden="true"
            />
          ) : contract ? (
            <Lock size={11} className="shrink-0 text-ethereal-graphite/50" aria-hidden="true" />
          ) : null}
          <Text
            as="span"
            size="sm"
            color={row.is_paid ? "sage" : row.orphaned ? "muted" : "default"}
            className="tabular-nums"
          >
            {stated ?? "–"}
          </Text>
        </span>
      )}

      <Eyebrow size="overline-sm" color="muted" className="w-7 shrink-0">
        {currency}
      </Eyebrow>

      {menu}
    </li>
  );
}
