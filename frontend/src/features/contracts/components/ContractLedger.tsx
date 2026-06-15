/**
 * @file ContractLedger.tsx
 * @description Grouped ledger section (cast or crew) — a titled card with a desktop
 * column header and the editable settlement rows beneath it. Kept deliberately thin:
 * all per-record behaviour lives in ContractRow.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/ContractLedger
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { ContractRow } from "./ContractRow";
import type { ContractRecordType } from "../api/contracts.service";
import {
  formatInteger,
  getSettlementState,
} from "../lib/contractsPresentation";
import type { ContractRecord } from "../lib/contractsPresentation";

interface ContractLedgerProps {
  title: string;
  icon: React.ReactNode;
  type: ContractRecordType;
  records: ContractRecord[];
  onDownload: (id: string, name: string, type: ContractRecordType) => void;
}

export function ContractLedger({
  title,
  icon,
  type,
  records,
  onDownload,
}: ContractLedgerProps): React.JSX.Element {
  const { t } = useTranslation();

  const owed = records.filter(
    (record) => getSettlementState(record, type) === "unpaid",
  ).length;
  const missing = records.filter(
    (record) => getSettlementState(record, type) === "unpriced",
  ).length;

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ethereal-ink/6 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-ethereal-gold/70" aria-hidden="true">
            {icon}
          </span>
          <Eyebrow as="h3" color="graphite">
            {title}
          </Eyebrow>
          <Caption color="muted" className="tabular-nums">
            {formatInteger(records.length)}
          </Caption>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {missing > 0 && (
            <Badge variant="warning">
              {t("contracts.ledger.missing", "{{n}} bez wyceny", { n: missing })}
            </Badge>
          )}
          {owed > 0 ? (
            <Badge variant="danger">
              {t("contracts.ledger.owed", "{{n}} do zapłaty", { n: owed })}
            </Badge>
          ) : (
            missing === 0 && (
              <Badge variant="success">
                {t("contracts.ledger.settled", "Rozliczone")}
              </Badge>
            )
          )}
        </div>
      </header>

      {/* Column header — desktop */}
      <div className="hidden border-b border-ethereal-ink/6 px-4 py-2 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(190px,0.9fr)_auto] lg:items-center lg:gap-4">
        <Caption color="muted">{t("contracts.ledger.col_person", "Osoba")}</Caption>
        <Caption color="muted">{t("contracts.ledger.col_role", "Rola")}</Caption>
        <Caption color="muted">
          {t("contracts.ledger.col_fee", "Honorarium")}
        </Caption>
        <Caption color="muted" className="text-right">
          {t("contracts.ledger.col_actions", "Rozliczenie")}
        </Caption>
      </div>

      <div className="divide-y divide-ethereal-ink/6">
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
  );
}
