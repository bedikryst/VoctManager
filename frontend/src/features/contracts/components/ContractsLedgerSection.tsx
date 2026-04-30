/**
 * @file ContractsLedgerSection.tsx
 * @description Grouped ledger section for either cast or crew contracts.
 * Provides a consistent wrapper, counts, and descriptive framing around editable records.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Text } from "@/shared/ui/primitives/typography";
import { formatInteger, isFeeMissing } from "../lib/contractsPresentation";
import { ContractRow } from "./ContractRow";
import type {
  EnrichedCrewAssignment,
  EnrichedParticipation,
} from "../types/contracts.dto";

interface ContractsLedgerSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  type: "CAST" | "CREW";
  records: EnrichedParticipation[] | EnrichedCrewAssignment[];
  onDownload: (
    id: string | number,
    name: string,
    type: "CAST" | "CREW",
  ) => void;
}

export function ContractsLedgerSection({
  title,
  description,
  icon,
  type,
  records,
  onDownload,
}: ContractsLedgerSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const missingCount = records.filter((record) => isFeeMissing(record.fee)).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <SectionHeader
            title={title}
            icon={icon}
            withFluidDivider={false}
            className="mb-0 pb-0"
          />
          <Text color="graphite" className="mt-2 max-w-2xl">
            {description}
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="glass">
            {formatInteger(records.length)} {t("contracts.table.records", "records")}
          </Badge>
          <Badge variant={missingCount > 0 ? "warning" : "success"}>
            {missingCount > 0
              ? `${formatInteger(missingCount)} ${t("contracts.table.missing_valuations", "missing valuations")}`
              : t("contracts.table.all_priced", "All records priced")}
          </Badge>
        </div>
      </div>

      <GlassCard variant="light" padding="none" isHoverable={false}>
        <div className="hidden border-b border-ethereal-incense/10 px-6 py-4 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(280px,1fr)_auto] lg:items-center lg:gap-4">
          <Badge variant="outline">{t("contracts.table.performer", "Person")}</Badge>
          <Badge variant="outline">{t("contracts.table.role", "Role")}</Badge>
          <Badge variant="outline">{t("contracts.table.remuneration", "Remuneration")}</Badge>
          <Badge variant="outline">{t("contracts.table.documents", "Documents")}</Badge>
        </div>

        <div className="divide-y divide-ethereal-incense/10">
          {records.map((record) => (
            <ContractRow
              key={`${type}-${record.id}`}
              record={record}
              type={type}
              onDownload={onDownload}
            />
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
