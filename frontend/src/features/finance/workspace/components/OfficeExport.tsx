/**
 * @file OfficeExport.tsx
 * @description Księga dla biura — the ledger CSV the office books from: every
 * counted fee and expense whose cost date falls in a range, across every
 * project at once. The range defaults to the current month, the period the
 * office books by.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/components/OfficeExport
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet } from "lucide-react";

import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption } from "@/shared/ui/primitives/typography";
import { FinanceService } from "../../api/finance.service";
import { toastFinanceError } from "../../lib/financeErrors";
import { todayIsoDate } from "../../lib/financePresentation";

/** The current calendar month, the period the office books by default. */
const currentMonth = (): { from: string; to: string } => {
  const today = todayIsoDate();
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const prefix = today.slice(0, 8);
  return { from: `${prefix}01`, to: `${prefix}${String(lastDay).padStart(2, "0")}` };
};

export function OfficeExport(): React.JSX.Element {
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
          "Honoraria i wydatki wliczone w koszt, których data kosztu (dla honorarium dzień koncertu) wypada w tym okresie — ze wszystkich projektów.",
        )}
      </Caption>
    </div>
  );
}
