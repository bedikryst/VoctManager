/**
 * @file PayablesCard.tsx
 * @description Do zapłaty — every fee the foundation still owes, across
 * projects, the soonest due first, a server page at a time. A row opens its
 * project's Honoraria on that very row, where it is paid; this list states the
 * debt and does not settle it.
 * The office's export sits here too, because this is where the question "what
 * do we book for the month" is asked: the ledger CSV for a date range, every
 * project at once.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/overview/components/PayablesCard
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, FileSpreadsheet, HandCoins } from "lucide-react";

import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { FinanceService } from "../../api/finance.service";
import { toastFinanceError } from "../../lib/financeErrors";
import { formatFinanceDate, todayIsoDate } from "../../lib/financePresentation";
import { formatLedgerAmount } from "../../lib/money";
import type { FinanceOverviewDTO } from "../../types/finance.dto";

interface PayablesCardProps {
  readonly page: FinanceOverviewDTO["payables"];
  readonly isFetching: boolean;
  readonly onPageChange: (offset: number) => void;
}

/** The current calendar month, the period the office books by default. */
const currentMonth = (): { from: string; to: string } => {
  const today = todayIsoDate();
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const prefix = today.slice(0, 8);
  return { from: `${prefix}01`, to: `${prefix}${String(lastDay).padStart(2, "0")}` };
};

function OfficeExport(): React.JSX.Element {
  const { t } = useTranslation();
  const [range, setRange] = useState(currentMonth);
  const [error, setError] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (): Promise<void> => {
    if (!range.from || !range.to) {
      setError(t("finance.export.range_required", "Podaj obie daty."));
      return;
    }
    if (range.from > range.to) {
      setError(t("finance.export.range_order", "Data początkowa jest późniejsza niż końcowa."));
      return;
    }
    setIsExporting(true);
    try {
      await FinanceService.downloadLedgerRange(range.from, range.to);
    } catch (failure) {
      toastFinanceError(failure, t, t("finance.download.error", "Nie udało się pobrać dokumentu."));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <DateTimeField
          granularity="date"
          label={t("finance.export.from", "Od")}
          value={range.from}
          onChange={(from) => {
            setRange((previous) => ({ ...previous, from }));
            setError(undefined);
          }}
        />
        <DateTimeField
          granularity="date"
          label={t("finance.export.to", "Do")}
          value={range.to}
          onChange={(to) => {
            setRange((previous) => ({ ...previous, to }));
            setError(undefined);
          }}
          error={error}
        />
        <Button
          variant="secondary"
          onClick={() => void handleExport()}
          isLoading={isExporting}
          leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
        >
          {t("finance.export.action", "Eksport dla biura")}
        </Button>
      </div>
      <Caption color="muted">
        {t(
          "finance.export.hint",
          "Honoraria wliczone w koszt, których data kosztu (dzień koncertu) wypada w tym okresie — ze wszystkich projektów.",
        )}
      </Caption>
    </div>
  );
}

export function PayablesCard({
  page,
  isFetching,
  onPageChange,
}: PayablesCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const today = todayIsoDate();
  const first = page.count === 0 ? 0 : page.offset + 1;
  const last = page.offset + page.results.length;
  const hasPrevious = page.offset > 0;
  const hasNext = last < page.count;

  return (
    <SectionCard
      as="h2"
      icon={<HandCoins size={15} aria-hidden="true" />}
      title={t("finance.portfolio.payables", "Do zapłaty")}
      bodyClassName="p-0"
      toolbar={<OfficeExport />}
      footer={
        page.count > page.limit ? (
          <div className="flex items-center justify-between gap-3">
            <Caption color="muted" className="tabular-nums">
              {t("finance.portfolio.range", "{{first}}–{{last}} z {{total}}", {
                first,
                last,
                total: page.count,
              })}
            </Caption>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasPrevious || isFetching}
                onClick={() => onPageChange(Math.max(page.offset - page.limit, 0))}
                leftIcon={<ChevronLeft size={14} aria-hidden="true" />}
              >
                {t("finance.portfolio.previous", "Wcześniejsze")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasNext || isFetching}
                onClick={() => onPageChange(page.offset + page.limit)}
                rightIcon={<ChevronRight size={14} aria-hidden="true" />}
              >
                {t("finance.portfolio.next", "Dalsze")}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {page.count === 0 ? (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<HandCoins size={22} strokeWidth={1.5} />}
          title={t("finance.portfolio.payables_empty", "Fundacja nie zalega z żadnym honorarium.")}
        />
      ) : (
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
          {page.results.map((payable) => {
            const overdue = payable.due_on !== null && payable.due_on < today;
            return (
              <li key={payable.cost_item_id}>
                <Link
                  to={`/panel/projects/${payable.project_id}/budget/people?focus=${payable.cost_item_id}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ethereal-ink/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Text as="span" size="sm" weight="medium" truncate>
                      {payable.payee_name}
                    </Text>
                    <Caption color="muted" className="truncate">
                      {[payable.payee_role, payable.project_title].filter(Boolean).join(" · ")}
                    </Caption>
                  </span>
                  {payable.due_on && (
                    <Caption color={overdue ? "gold" : "muted"} className="shrink-0 tabular-nums">
                      {overdue
                        ? t("finance.portfolio.overdue", "po terminie {{date}}", {
                            date: formatFinanceDate(payable.due_on, i18n.language),
                          })
                        : t("finance.portfolio.due", "termin {{date}}", {
                            date: formatFinanceDate(payable.due_on, i18n.language),
                          })}
                    </Caption>
                  )}
                  <Text as="span" size="sm" weight="medium" className="w-24 shrink-0 text-right tabular-nums">
                    {formatLedgerAmount(payable.cost_amount) ?? "–"}
                  </Text>
                  <Eyebrow size="overline-sm" color="muted" className="w-7 shrink-0">
                    {t("common.currency", "PLN")}
                  </Eyebrow>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
