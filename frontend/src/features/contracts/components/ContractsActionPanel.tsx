/**
 * @file ContractsActionPanel.tsx
 * @description Action rail for bulk valuation and project-level export workflows.
 * Keeps high-impact finance operations grouped inside one predictable control surface.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Calculator, Download, Users } from "lucide-react";

import { ExportContractButton } from "@/shared/widgets/domain/ExportContractButton";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatInteger, parseFeeValue } from "../lib/contractsPresentation";

interface ContractsActionPanelProps {
  projectId: string;
  globalFee: string;
  currentCastCount: number;
  missingContractsCount: number;
  isBulkUpdating: boolean;
  onGlobalFeeChange: (value: string) => void;
  onApplyGlobalFee: () => void;
}

export function ContractsActionPanel({
  projectId,
  globalFee,
  currentCastCount,
  missingContractsCount,
  isBulkUpdating,
  onGlobalFeeChange,
  onApplyGlobalFee,
}: ContractsActionPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  const parsedFee = parseFeeValue(globalFee);
  const feeError =
    globalFee.trim().length > 0 && parsedFee == null
      ? t(
          "contracts.actions.bulk_fee_error",
          "Enter a valid remuneration value.",
        )
      : undefined;

  const isBulkDisabled =
    isBulkUpdating || parsedFee == null || currentCastCount === 0;

  return (
    <GlassCard variant="light" padding="md" isHoverable={false}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="glass" icon={<Calculator size={12} />}>
                {t("contracts.actions.bulk_badge", "Bulk valuation")}
              </Badge>
              <Badge variant="outline" icon={<Users size={12} />}>
                {t("contracts.actions.cast_count", {
                  count: formatInteger(currentCastCount),
                  defaultValue: "{{count}} cast records",
                })}
              </Badge>
            </div>
            <Eyebrow color="default">
              {t(
                "contracts.actions.bulk_title",
                "Apply one remuneration amount across the vocal roster.",
              )}
            </Eyebrow>
            <Text color="graphite">
              {t(
                "contracts.actions.bulk_description",
                "This action affects cast contracts only. It is useful when the production uses a shared standard fee before individual adjustments.",
              )}
            </Text>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="w-full lg:max-w-xs">
              <Input
                type="number"
                inputMode="decimal"
                value={globalFee}
                onChange={(event) => onGlobalFeeChange(event.target.value)}
                label={t("contracts.actions.bulk_label", "Gross fee")}
                placeholder={t("contracts.actions.bulk_placeholder", "0.00")}
                rightElement={t("contracts.actions.currency_label", "PLN")}
                error={feeError}
                className="font-mono text-right"
              />
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-auto lg:pt-6">
              <Button
                variant="primary"
                onClick={onApplyGlobalFee}
                disabled={isBulkDisabled}
                isLoading={isBulkUpdating}
                leftIcon={<Calculator size={14} aria-hidden="true" />}
                className="w-full lg:w-auto"
              >
                {t("contracts.actions.bulk_apply", "Apply valuation")}
              </Button>
              <Text size="xs" color="muted" className="max-w-sm">
                {currentCastCount === 0
                  ? t(
                      "contracts.actions.bulk_disabled_reason",
                      "Bulk valuation activates after at least one cast record is assigned to the project.",
                    )
                  : t(
                      "contracts.actions.bulk_hint",
                      "You can still refine individual remuneration values inside each record below.",
                    )}
              </Text>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between gap-5 rounded-[1.75rem] border border-ethereal-incense/15 bg-white/55 p-5 shadow-[0_16px_40px_rgba(22,20,18,0.05)]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="glass" icon={<Download size={12} />}>
                {t("contracts.actions.export_badge", "Project export")}
              </Badge>
              <Badge
                variant={missingContractsCount > 0 ? "warning" : "success"}
              >
                {missingContractsCount > 0
                  ? t(
                      "contracts.actions.export_missing",
                      {
                        count: formatInteger(missingContractsCount),
                        defaultValue: "{{count}} valuations missing",
                      },
                    )
                  : t(
                      "contracts.actions.export_ready",
                      "Ledger ready for export",
                    )}
              </Badge>
            </div>

            <Eyebrow color="default">
              {t(
                "contracts.actions.export_title",
                "Generate a contract package for the selected project.",
              )}
            </Eyebrow>
            <Text color="graphite">
              {t(
                "contracts.actions.export_description",
                "Use the background export pipeline to prepare the ZIP package with contract PDFs for the whole event.",
              )}
            </Text>
          </div>

          <ExportContractButton projectId={projectId} className="w-full" />
        </div>
      </div>
    </GlassCard>
  );
}
