/**
 * @file LedgerHeader.tsx
 * @description Command strip above a project's ledger: event context, the background
 * ZIP export, ledger filters (everyone / unpriced / unpaid), and a cast-wide bulk
 * valuation. Financial coverage itself is NOT repeated here — it lives once in the
 * SettlementSummary rail, which is project-scoped while a project is selected.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/LedgerHeader
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, CalendarClock, Calculator, MapPin } from "lucide-react";

import { getLocationLabel } from "@/features/projects/lib/projectPresentation";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { cn } from "@/shared/lib/utils";
import { ExportContractButton } from "@/widgets/domain/ExportContractButton";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { Caption, Heading } from "@/shared/ui/primitives/typography";
import type { ContractRecordType } from "../api/contracts.service";
import type { LedgerFilter, ProjectRollup } from "../hooks/useContractsData";
import {
  getProjectStatusMeta,
  parseFeeValue,
} from "../lib/contractsPresentation";

interface LedgerHeaderProps {
  stats: ProjectRollup;
  ledgerFilter: LedgerFilter;
  onFilterChange: (filter: LedgerFilter) => void;
  globalFee: string;
  onGlobalFeeChange: (value: string) => void;
  bulkTarget: ContractRecordType;
  onBulkTargetChange: (target: ContractRecordType) => void;
  onApplyGlobalFee: () => void;
  isBulkUpdating: boolean;
  onMarkAllPaid: () => void;
  unpaidCount: number;
  isMarkingPaid: boolean;
}

export function LedgerHeader({
  stats,
  ledgerFilter,
  onFilterChange,
  globalFee,
  onGlobalFeeChange,
  bulkTarget,
  onBulkTargetChange,
  onApplyGlobalFee,
  isBulkUpdating,
  onMarkAllPaid,
  unpaidCount,
  isMarkingPaid,
}: LedgerHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const { project } = stats;

  const statusMeta = getProjectStatusMeta(project.status);
  const locationLabel = getLocationLabel(project.location);
  const parsedFee = parseFeeValue(globalFee);
  const targetCount = bulkTarget === "CAST" ? stats.castCount : stats.crewCount;
  const bulkDisabled =
    isBulkUpdating || parsedFee == null || parsedFee < 0 || targetCount === 0;

  const bulkTargets: { id: ContractRecordType; label: string }[] = [
    { id: "CAST", label: t("contracts.sections.cast", "Obsada") },
    { id: "CREW", label: t("contracts.sections.crew", "Ekipa") },
  ];

  const filters: { id: LedgerFilter; label: string; count: number }[] = [
    {
      id: "all",
      label: t("contracts.filters.all", "Wszyscy"),
      count: stats.totalRecords,
    },
    {
      id: "unpriced",
      label: t("contracts.filters.unpriced", "Bez wyceny"),
      count: stats.missingCount,
    },
    {
      id: "unpaid",
      label: t("contracts.filters.unpaid", "Do zapłaty"),
      count: stats.outstandingCount,
    },
  ];

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false}>
      {/* Context + export */}
      <div className="flex flex-col gap-4 border-b border-ethereal-ink/6 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              variant={statusMeta.tone}
              label={t(statusMeta.translationKey, statusMeta.fallback)}
              isPulsing={statusMeta.tone === "active"}
            />
          </div>
          <Heading as="h2" size="2xl" weight="medium" className="truncate">
            {project.title}
          </Heading>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {project.date_time && (
              <Caption color="muted" className="inline-flex items-center gap-1">
                <CalendarClock size={12} aria-hidden="true" />
                {formatLocalizedDateTime(
                  project.date_time,
                  { day: "numeric", month: "long", year: "numeric" },
                  undefined,
                  project.timezone,
                )}
              </Caption>
            )}
            {locationLabel && (
              <Caption
                color="muted"
                className="inline-flex max-w-[18rem] items-center gap-1 truncate"
              >
                <MapPin size={12} aria-hidden="true" />
                <span className="truncate">{locationLabel}</span>
              </Caption>
            )}
            <Caption color="muted" className="tabular-nums">
              {t("contracts.header.mix", "{{cast}} obsada · {{crew}} ekipa", {
                cast: stats.castCount,
                crew: stats.crewCount,
              })}
            </Caption>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 lg:w-72">
          <Button
            variant="secondary"
            onClick={onMarkAllPaid}
            disabled={unpaidCount === 0 || isMarkingPaid}
            isLoading={isMarkingPaid}
            leftIcon={<BadgeCheck size={15} aria-hidden="true" />}
            fullWidth
            title={t(
              "contracts.mark_all.hint",
              "Oznacza wszystkie wycenione, niezapłacone honoraria w projekcie jako zapłacone.",
            )}
          >
            {t("contracts.mark_all.button", "Oznacz zapłacone")}
            {unpaidCount > 0 && (
              <span className="ml-1.5 rounded-full bg-ethereal-ink/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                {unpaidCount}
              </span>
            )}
          </Button>
          <ExportContractButton projectId={String(project.id)} />
        </div>
      </div>

      {/* Filters + bulk valuation */}
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-end xl:justify-between">
        <div
          className="inline-flex flex-wrap gap-1 rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/60 p-1"
          role="group"
          aria-label={t("contracts.filters.aria", "Filtr rozliczeń")}
        >
          {filters.map((filter) => {
            const isActive = ledgerFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(filter.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                  isActive
                    ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                    : "text-ethereal-graphite hover:bg-ethereal-parchment/50",
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    isActive
                      ? "bg-ethereal-ink/10 text-ethereal-ink"
                      : "bg-ethereal-ink/5 text-ethereal-graphite/70",
                  )}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Caption color="muted" className="ml-1">
              {t("contracts.bulk.target_label", "Stawka zbiorcza dla")}
            </Caption>
            <div
              className="inline-flex gap-1 rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/60 p-1"
              role="group"
              aria-label={t("contracts.bulk.target_label", "Stawka zbiorcza dla")}
            >
              {bulkTargets.map((target) => {
                const isActive = bulkTarget === target.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onBulkTargetChange(target.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                      isActive
                        ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                        : "text-ethereal-graphite hover:bg-ethereal-parchment/50",
                    )}
                  >
                    {target.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-32">
            <Input
              type="number"
              inputMode="decimal"
              value={globalFee}
              onChange={(event) => onGlobalFeeChange(event.target.value)}
              label={t("contracts.bulk.label", "Stawka")}
              placeholder={t("contracts.bulk.placeholder", "np. 500")}
              rightElement={t("contracts.row.currency", "PLN")}
              className="py-2 text-right font-mono"
            />
          </div>
          <Button
            variant="secondary"
            onClick={onApplyGlobalFee}
            disabled={bulkDisabled}
            isLoading={isBulkUpdating}
            leftIcon={<Calculator size={14} aria-hidden="true" />}
            title={t(
              "contracts.bulk.hint",
              "Ustawia jedną stawkę dla wybranej grupy (pomija już zapłacone).",
            )}
          >
            {t("contracts.bulk.apply", "Zastosuj")}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
