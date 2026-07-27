/**
 * @file PayablesBoard.tsx
 * @description Portfolio protagonist: one cross-project feed of everyone still owed
 * or unpriced, most-urgent first. Each row settles in place or jumps into its
 * project ledger — so "who do I still owe?" is answerable without opening projects
 * one by one. Replaces the old dead "select a project" idle state.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/PayablesBoard
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  FileSpreadsheet,
  ListChecks,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useSetPaid } from "../api/contracts.queries";
import type { LedgerEntry, LedgerFilter } from "../hooks/useContractsData";
import {
  formatContractCurrency,
  formatInteger,
  getContractPersonName,
  getContractRoleLabel,
  getSettlementState,
  parseFeeValue,
} from "../lib/contractsPresentation";

interface PayablesBoardProps {
  payables: LedgerEntry[];
  onOpenProject: (projectId: string) => void;
  onExportCsv: () => void;
  exportDisabled: boolean;
}

const PayableRow = ({
  entry,
  onOpenProject,
}: {
  entry: LedgerEntry;
  onOpenProject: (projectId: string) => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const setPaid = useSetPaid(entry.type);
  const { record, type, project } = entry;

  const nameMeta = getContractPersonName(record, type);
  const roleMeta = getContractRoleLabel(record, type);
  const personName = nameMeta.translationKey
    ? t(nameMeta.translationKey, nameMeta.fallback)
    : nameMeta.fallback;
  const roleLabel = roleMeta.translationKey
    ? t(roleMeta.translationKey, roleMeta.fallback)
    : roleMeta.fallback;

  const state = getSettlementState(record, type);
  const amount = parseFeeValue(record.fee);

  const handlePay = async (): Promise<void> => {
    try {
      await setPaid.mutateAsync({ id: String(record.id), isPaid: true });
      toast.success(
        t("contracts.payables.paid_toast", "Oznaczono {{name}} jako zapłacone.", {
          name: personName,
        }),
      );
    } catch (error) {
      toastApiError(error, t, { fallbackDescription: t("contracts.toast.payment_error", "Nie udało się zmienić statusu płatności.") });
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text size="sm" weight="semibold" truncate>
            {personName}
          </Text>
          <Badge variant={type === "CAST" ? "glass" : "neutral"}>{roleLabel}</Badge>
        </div>
        <button
          type="button"
          onClick={() => onOpenProject(String(project.id))}
          className="group/proj mt-0.5 inline-flex max-w-full items-center gap-1 text-left"
        >
          <span className="truncate text-[11px] leading-snug text-ethereal-graphite/60 transition-colors group-hover/proj:text-ethereal-gold">
            {project.title}
          </span>
          <ArrowUpRight
            size={11}
            className="shrink-0 text-ethereal-graphite/50 transition-colors group-hover/proj:text-ethereal-gold"
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="shrink-0 text-right">
        {state === "unpriced" ? (
          <Badge variant="warning">
            {t("contracts.payables.unpriced", "Brak wyceny")}
          </Badge>
        ) : (
          <Text
            size="sm"
            weight="semibold"
            className="tabular-nums text-ethereal-crimson"
          >
            {formatContractCurrency(amount)}
          </Text>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {state === "unpaid" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePay()}
            disabled={setPaid.isPending}
            title={t("contracts.row.mark_paid", "Oznacz jako zapłacone")}
            leftIcon={<Check size={13} />}
            className="h-8 px-2.5 max-sm:gap-0"
          >
            <span className="hidden sm:inline">
              {t("contracts.payables.pay", "Zapłacone")}
            </span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenProject(String(project.id))}
            title={t("contracts.payables.open", "Otwórz w projekcie")}
            leftIcon={<ArrowUpRight size={13} />}
            className="h-8 px-2.5 max-sm:gap-0"
          >
            <span className="hidden sm:inline">
              {t("contracts.payables.open_short", "Wyceń")}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};

export function PayablesBoard({
  payables,
  onOpenProject,
  onExportCsv,
  exportDisabled,
}: PayablesBoardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<LedgerFilter>("all");

  const exportButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={onExportCsv}
      disabled={exportDisabled}
      leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
      title={t("contracts.csv.hint", "Pełna lista rozliczeń do księgowości (CSV)")}
    >
      {t("contracts.csv.export", "Eksport CSV")}
    </Button>
  );

  const counts = useMemo(() => {
    let unpriced = 0;
    let unpaid = 0;
    for (const entry of payables) {
      const state = getSettlementState(entry.record, entry.type);
      if (state === "unpriced") unpriced += 1;
      else if (state === "unpaid") unpaid += 1;
    }
    return { all: payables.length, unpriced, unpaid };
  }, [payables]);

  const visible = useMemo(() => {
    if (filter === "all") return payables;
    return payables.filter(
      (entry) => getSettlementState(entry.record, entry.type) === filter,
    );
  }, [payables, filter]);

  if (payables.length === 0) {
    return (
      <StatePanel
        tone="default"
        icon={<BadgeCheck size={28} strokeWidth={1.5} className="text-ethereal-sage" />}
        eyebrow={t("contracts.payables.clear_eyebrow", "Czysto")}
        title={t(
          "contracts.payables.clear_title",
          "Wszystkie honoraria są rozliczone.",
        )}
        description={t(
          "contracts.payables.clear_desc",
          "Żaden projekt nie ma otwartych wycen ani zaległych wypłat. Wybierz projekt z lewej, aby przejrzeć szczegóły lub wygenerować umowy.",
        )}
        actions={exportDisabled ? undefined : exportButton}
      />
    );
  }

  const filters: { id: LedgerFilter; label: string; count: number }[] = [
    { id: "all", label: t("contracts.filters.all_short", "Wszystko"), count: counts.all },
    {
      id: "unpriced",
      label: t("contracts.filters.unpriced", "Bez wyceny"),
      count: counts.unpriced,
    },
    {
      id: "unpaid",
      label: t("contracts.filters.unpaid", "Do zapłaty"),
      count: counts.unpaid,
    },
  ];

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ListChecks size={15} className="text-ethereal-gold/70" aria-hidden="true" />
          <Eyebrow as="h2" color="graphite">
            {t("contracts.payables.title", "Do rozliczenia")}
          </Eyebrow>
          <Caption color="muted" className="tabular-nums">
            {formatInteger(payables.length)}
          </Caption>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {exportButton}
          <SegmentedTabs
            items={filters}
            value={filter}
            onChange={setFilter}
            ariaLabel={t("contracts.filters.aria", "Filtr rozliczeń")}
          />
        </div>
      </header>

      <div className="max-h-[64vh] divide-y divide-hairline overflow-y-auto overflow-x-hidden">
        {visible.map((entry) => (
          <PayableRow key={entry.id} entry={entry} onOpenProject={onOpenProject} />
        ))}
        {visible.length === 0 && (
          <Caption color="muted" className="block px-5 py-10 text-center">
            {t("contracts.payables.none_in_filter", "Brak pozycji w tym filtrze.")}
          </Caption>
        )}
      </div>
    </GlassCard>
  );
}
