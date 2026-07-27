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
import { ExportContractButton } from "@/widgets/domain/ExportContractButton";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Eyebrow, Heading } from "@/shared/ui/primitives/typography";
import type { ContractRecordType } from "../api/contracts.service";
import type { LedgerFilter, ProjectRollup } from "../hooks/useContractsData";
import {
  getProjectStatusMeta,
  parseFeeValue,
  PROJECT_STATUS_VARIANT,
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
      <div className="flex flex-col gap-4 border-b border-hairline p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {/* No pulse: a production stays ACTIVE for months, so the sweep
                would run permanently and stop meaning "right now". */}
            <Badge variant={PROJECT_STATUS_VARIANT[statusMeta.tone]}>
              {t(statusMeta.translationKey, statusMeta.fallback)}
            </Badge>
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
            {/* The count lives on the "Do zapłaty" filter one row below; saying
                it again on the button made one figure into three on one card. */}
            {t("contracts.mark_all.button", "Oznacz zapłacone")}
          </Button>
          <ExportContractButton projectId={String(project.id)} />
        </div>
      </div>

      {/* Filters + bulk valuation */}
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-end xl:justify-between">
        <SegmentedTabs
          items={filters}
          value={ledgerFilter}
          onChange={onFilterChange}
          ariaLabel={t("contracts.filters.aria", "Filtr rozliczeń")}
        />

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Eyebrow as="p" color="muted" className="ml-1">
              {t("contracts.bulk.target_label", "Stawka zbiorcza dla")}
            </Eyebrow>
            <SegmentedTabs
              items={bulkTargets}
              value={bulkTarget}
              onChange={onBulkTargetChange}
              ariaLabel={t("contracts.bulk.target_label", "Stawka zbiorcza dla")}
            />
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
