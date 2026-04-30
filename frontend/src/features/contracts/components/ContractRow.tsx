/**
 * @file ContractRow.tsx
 * @description Responsive ledger record for cast and crew remuneration workflows.
 * Keeps fee editing, contract status, and PDF availability synchronized with server data.
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileText, Save } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useUpdateFee } from "../api/contracts.queries";
import {
  areFeesEqual,
  formatContractCurrency,
  getContractPersonName,
  getContractRoleLabel,
  getContractStatusMeta,
  isFeeMissing,
  parseFeeValue,
} from "../lib/contractsPresentation";
import type {
  EnrichedCrewAssignment,
  EnrichedParticipation,
} from "../types/contracts.dto";

interface ContractRowProps {
  record: EnrichedParticipation | EnrichedCrewAssignment;
  type: "CAST" | "CREW";
  onDownload: (
    id: string | number,
    name: string,
    type: "CAST" | "CREW",
  ) => void;
}

const toInputValue = (value: string | number | null | undefined): string =>
  value == null ? "" : String(value);

export function ContractRow({
  record,
  type,
  onDownload,
}: ContractRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const updateFeeMutation = useUpdateFee(type);
  const [draftFee, setDraftFee] = useState<string>(toInputValue(record.fee));
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const personNameMeta = getContractPersonName(record, type);
  const roleLabelMeta = getContractRoleLabel(record, type);
  const statusMeta = getContractStatusMeta(record);

  const personName = personNameMeta.translationKey
    ? t(personNameMeta.translationKey, personNameMeta.fallback)
    : personNameMeta.fallback;
  const roleLabel = roleLabelMeta.translationKey
    ? t(roleLabelMeta.translationKey, roleLabelMeta.fallback)
    : roleLabelMeta.fallback;
  const currentFee = parseFeeValue(record.fee);
  const parsedDraftFee = parseFeeValue(draftFee);
  const feeMissing = isFeeMissing(record.fee);

  const feeError =
    draftFee.trim().length > 0 && parsedDraftFee == null
      ? t("contracts.row.invalid_fee", "Enter a valid remuneration value.")
      : undefined;

  useEffect(() => {
    setDraftFee(toInputValue(record.fee));
  }, [record.fee]);

  useEffect(
    () => () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    },
    [],
  );

  const handleSaveFee = async (): Promise<void> => {
    if (feeError) {
      return;
    }

    setSaveSuccess(false);

    try {
      await updateFeeMutation.mutateAsync({
        id: String(record.id),
        fee: parsedDraftFee,
      });

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }

      setSaveSuccess(true);
      successTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      toast.error(
        t(
          "contracts.toast.save_error",
          "Could not save remuneration for {{name}}.",
          { name: personName },
        ),
      );
    }
  };

  const saveButtonLabel = saveSuccess
    ? t("contracts.row.saved", "Saved")
    : t("contracts.row.save", "Save");

  const saveDisabled =
    updateFeeMutation.isPending ||
    Boolean(feeError) ||
    areFeesEqual(currentFee, draftFee);

  return (
    <div
      className={cn(
        "grid gap-4 px-4 py-5 transition-colors duration-300 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(280px,1fr)_auto] lg:items-center lg:gap-5 lg:px-6",
        feeMissing ? "bg-ethereal-gold/5" : "hover:bg-white/35",
      )}
    >
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <Text size="sm" weight="bold" truncate>
            {personName}
          </Text>
          <Text size="xs" color="graphite">
            {type === "CAST"
              ? t("contracts.row.cast_record", "Cast contract record")
              : t("contracts.row.crew_record", "Crew contract record")}
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <Badge variant="glass">{roleLabel}</Badge>
          <StatusBadge
            variant={statusMeta.tone}
            label={t(statusMeta.translationKey, statusMeta.fallback)}
          />
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-2">
        <Badge variant="glass">{roleLabel}</Badge>
        <StatusBadge
          variant={statusMeta.tone}
          label={t(statusMeta.translationKey, statusMeta.fallback)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
          <div className="w-full sm:max-w-[220px]">
            <Input
              type="number"
              inputMode="decimal"
              value={draftFee}
              onChange={(event) => setDraftFee(event.target.value)}
              placeholder={t("contracts.row.fee_placeholder", "0.00")}
              rightElement={t("contracts.row.currency_label", "PLN")}
              disabled={updateFeeMutation.isPending}
              error={feeError}
              className="font-mono text-right"
            />
          </div>

          <Button
            onClick={handleSaveFee}
            disabled={saveDisabled}
            variant={saveSuccess ? "secondary" : "primary"}
            size="sm"
            isLoading={updateFeeMutation.isPending}
            leftIcon={
              saveSuccess ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )
            }
            className="w-full sm:w-auto"
          >
            {saveButtonLabel}
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:justify-end">
          {feeMissing ? (
            <>
              <AlertTriangle
                size={14}
                className="text-ethereal-crimson"
                aria-hidden="true"
              />
              <Eyebrow color="crimson">
                {t(
                  "contracts.row.missing_fee",
                  "PDF export unlocks after valuation.",
                )}
              </Eyebrow>
            </>
          ) : (
            <Text size="xs" color="muted">
              {t("contracts.row.current_fee", "Current fee: {{amount}}", {
                amount: formatContractCurrency(record.fee),
              })}
            </Text>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownload(record.id, personName, type)}
          disabled={feeMissing}
          leftIcon={<FileText size={14} aria-hidden="true" />}
          className="w-full sm:w-auto"
        >
          {t("contracts.row.download_pdf", "PDF")}
        </Button>
      </div>
    </div>
  );
}
