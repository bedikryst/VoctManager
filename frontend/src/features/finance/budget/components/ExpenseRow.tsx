/**
 * @file ExpenseRow.tsx
 * @description One expense: who was paid, for what, against which document,
 * and where it sits in the plan. The resting state says little — a document
 * number, a line number — and the exceptions speak: a cost outside the plan
 * once there is a plan, a due date that has passed, a payment (in sage).
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/ExpenseRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Paperclip } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  categoryLabel,
  documentTypeLabel,
  formatFinanceDate,
  todayIsoDate,
} from "../../lib/financePresentation";
import { formatLedgerAmount } from "../../lib/money";
import type { ExpenseRowDTO, PlanLineDTO } from "../../types/finance.dto";

type CaptionTone = "muted" | "gold" | "sage";

interface Fact {
  readonly key: string;
  readonly text: string;
  readonly tone: CaptionTone;
}

interface ExpenseRowProps {
  readonly expense: ExpenseRowDTO;
  /** The line it is charged to, or null. */
  readonly line: PlanLineDTO | null;
  /** The budget has a plan, so "outside the plan" is worth saying. */
  readonly hasPlan: boolean;
  readonly isFocused: boolean;
  readonly menu: React.ReactNode;
}

export function ExpenseRow({
  expense,
  line,
  hasPlan,
  isFocused,
  menu,
}: ExpenseRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const currency = t("common.currency", "PLN");
  const language = i18n.language;

  const facts: Fact[] = [];
  if (expense.description) {
    facts.push({ key: "description", text: expense.description, tone: "muted" });
  }
  facts.push({ key: "category", text: categoryLabel(t, expense.category), tone: "muted" });
  if (expense.document_type) {
    const document = [documentTypeLabel(t, expense.document_type), expense.document_number]
      .filter(Boolean)
      .join(" ");
    facts.push({ key: "document", text: document, tone: "muted" });
  }
  if (line) {
    facts.push({ key: "line", text: line.number, tone: "muted" });
  } else if (hasPlan) {
    facts.push({
      key: "line",
      text: t("finance.row.outside_plan", "poza kosztorysem"),
      tone: "gold",
    });
  }
  if (expense.paid_on) {
    facts.push({
      key: "paid",
      text: t("finance.expenses.paid_on", "zapłacone {{date}}", {
        date: formatFinanceDate(expense.paid_on, language),
      }),
      tone: "sage",
    });
  } else if (expense.due_on) {
    facts.push({
      key: "due",
      text: t("finance.expenses.due_on", "termin {{date}}", {
        date: formatFinanceDate(expense.due_on, language),
      }),
      tone: expense.due_on < todayIsoDate() ? "gold" : "muted",
    });
  }

  return (
    <li
      id={`expense-row-${expense.id}`}
      className={cn(
        "flex scroll-mt-24 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ethereal-ink/3",
        isFocused && "bg-ethereal-gold/10 ring-1 ring-inset ring-ethereal-gold/40",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <Text as="span" size="sm" weight="medium" truncate>
            {expense.vendor_name}
          </Text>
          {expense.attachments.length > 0 && (
            <Paperclip
              size={12}
              className="shrink-0 text-ethereal-graphite/50"
              aria-label={t("finance.expenses.has_files", "Pliki: {{count}}", {
                count: expense.attachments.length,
              })}
            />
          )}
        </span>
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
      </span>

      <span className="flex min-h-11 w-28 shrink-0 items-center justify-end gap-1.5">
        {expense.is_paid && (
          <Check size={12} strokeWidth={3} className="shrink-0 text-ethereal-sage" aria-hidden="true" />
        )}
        <Text
          as="span"
          size="sm"
          color={expense.is_paid ? "sage" : "default"}
          className="tabular-nums"
        >
          {formatLedgerAmount(expense.cost_amount) ?? "–"}
        </Text>
      </span>

      <Eyebrow size="overline-sm" color="muted" className="w-7 shrink-0">
        {currency}
      </Eyebrow>

      {menu}
    </li>
  );
}
