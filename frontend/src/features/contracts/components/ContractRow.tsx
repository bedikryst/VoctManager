/**
 * @file ContractRow.tsx
 * @description One settlement ledger record (cast or crew). Three jobs in one
 * dense row: price it (inline fee edit), settle it (paid toggle that timestamps
 * server-side), and document it (contract PDF, unlocked once priced). Row tint
 * follows the settlement state so unpriced / owed rows read at a glance.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/ContractRow
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  FileText,
  Save,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useSetPaid, useUpdateFee } from "../api/contracts.queries";
import type { ContractRecordType } from "../api/contracts.service";
import {
  areFeesEqual,
  getContractPersonName,
  getContractRoleLabel,
  getContractStatusMeta,
  getSettlementState,
  isFeeMissing,
  parseFeeValue,
} from "../lib/contractsPresentation";
import type { ContractRecord } from "../lib/contractsPresentation";

interface ContractRowProps {
  record: ContractRecord;
  type: ContractRecordType;
  onDownload: (id: string, name: string, type: ContractRecordType) => void;
}

const toInputValue = (value: string | number | null | undefined): string =>
  value == null ? "" : String(value);

export function ContractRow({
  record,
  type,
  onDownload,
}: ContractRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const updateFee = useUpdateFee(type);
  const setPaid = useSetPaid(type);

  const [draftFee, setDraftFee] = useState<string>(toInputValue(record.fee));
  const [savedFlash, setSavedFlash] = useState(false);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftFee(toInputValue(record.fee));
  }, [record.fee]);

  useEffect(
    () => () => {
      if (flashRef.current) clearTimeout(flashRef.current);
    },
    [],
  );

  const nameMeta = getContractPersonName(record, type);
  const roleMeta = getContractRoleLabel(record, type);
  const statusMeta = getContractStatusMeta(record);
  const personName = nameMeta.translationKey
    ? t(nameMeta.translationKey, nameMeta.fallback)
    : nameMeta.fallback;
  const roleLabel = roleMeta.translationKey
    ? t(roleMeta.translationKey, roleMeta.fallback)
    : roleMeta.fallback;

  const settlementState = getSettlementState(record, type);
  const feeMissing = isFeeMissing(record.fee);
  const paid = settlementState === "paid";
  const parsedDraft = parseFeeValue(draftFee);
  const feeError =
    draftFee.trim().length > 0 && parsedDraft == null
      ? t("contracts.row.invalid_fee", "Podaj poprawną kwotę.")
      : undefined;
  const isDirty = !areFeesEqual(record.fee, draftFee) && !feeError;

  const handleSaveFee = async (): Promise<void> => {
    if (!isDirty) return;
    try {
      await updateFee.mutateAsync({ id: String(record.id), fee: parsedDraft });
      if (flashRef.current) clearTimeout(flashRef.current);
      setSavedFlash(true);
      flashRef.current = setTimeout(() => setSavedFlash(false), 1600);
    } catch {
      toast.error(
        t("contracts.toast.save_error", "Nie udało się zapisać honorarium dla {{name}}.", {
          name: personName,
        }),
      );
    }
  };

  const handleTogglePaid = async (): Promise<void> => {
    try {
      await setPaid.mutateAsync({ id: String(record.id), isPaid: !paid });
    } catch {
      toast.error(
        t("contracts.toast.payment_error", "Nie udało się zmienić statusu płatności."),
      );
    }
  };

  return (
    <div
      className={cn(
        "grid gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(190px,0.9fr)_auto] lg:items-center lg:gap-4",
        settlementState === "unpriced" && "bg-ethereal-gold/[0.04]",
        paid && "bg-ethereal-sage/[0.04]",
        settlementState === "inactive" && "opacity-60",
      )}
    >
      {/* Identity */}
      <div className="min-w-0">
        <Text size="sm" weight="semibold" truncate>
          {personName}
        </Text>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 lg:hidden">
          <Badge variant="glass">{roleLabel}</Badge>
          <StatusBadge
            variant={statusMeta.tone}
            label={t(statusMeta.translationKey, statusMeta.fallback)}
          />
        </div>
        {paid && record.paid_at && (
          <Caption color="muted" className="mt-0.5 hidden items-center gap-1 lg:inline-flex">
            <BadgeCheck size={11} aria-hidden="true" />
            {t("contracts.row.paid_on", "Zapłacono {{date}}", {
              date: formatLocalizedDate(record.paid_at, {
                day: "numeric",
                month: "short",
              }),
            })}
          </Caption>
        )}
      </div>

      {/* Role + status (desktop) */}
      <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
        <Badge variant="glass">{roleLabel}</Badge>
        <StatusBadge
          variant={statusMeta.tone}
          label={t(statusMeta.translationKey, statusMeta.fallback)}
        />
      </div>

      {/* Fee editor */}
      <div className="flex items-center gap-2">
        <div className="w-full max-w-[160px]">
          <Input
            type="number"
            inputMode="decimal"
            value={draftFee}
            onChange={(event) => setDraftFee(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSaveFee();
              }
            }}
            placeholder={t("contracts.row.fee_placeholder", "0,00")}
            rightElement={t("contracts.row.currency", "PLN")}
            error={feeError}
            disabled={updateFee.isPending}
            className="py-2 text-right font-mono"
            aria-label={t("contracts.row.fee_aria", "Honorarium dla {{name}}", {
              name: personName,
            })}
          />
        </div>
        <Button
          variant={savedFlash ? "secondary" : "primary"}
          size="icon"
          onClick={() => void handleSaveFee()}
          disabled={!isDirty || updateFee.isPending}
          isLoading={updateFee.isPending}
          title={t("contracts.row.save", "Zapisz honorarium")}
          aria-label={t("contracts.row.save", "Zapisz honorarium")}
          className={cn(
            "h-9 w-9 shrink-0 transition-opacity",
            !isDirty && !savedFlash && "pointer-events-none opacity-0",
          )}
        >
          {savedFlash ? <Check size={15} /> : <Save size={15} />}
        </Button>
      </div>

      {/* Settle + document */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void handleTogglePaid()}
          disabled={feeMissing || setPaid.isPending}
          title={
            feeMissing
              ? t("contracts.row.pay_blocked", "Najpierw wyceń honorarium")
              : paid
                ? t("contracts.row.mark_unpaid", "Cofnij oznaczenie zapłaty")
                : t("contracts.row.mark_paid", "Oznacz jako zapłacone")
          }
          aria-pressed={paid}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:cursor-not-allowed disabled:opacity-40",
            paid
              ? "border-ethereal-sage/40 bg-ethereal-sage/10 text-ethereal-sage hover:bg-ethereal-sage/15"
              : "border-ethereal-ink/12 bg-ethereal-alabaster text-ethereal-graphite hover:border-ethereal-sage/40 hover:text-ethereal-sage",
          )}
        >
          {paid ? <BadgeCheck size={14} /> : <Check size={14} />}
          <span className="hidden sm:inline">
            {paid
              ? t("contracts.row.paid", "Zapłacone")
              : t("contracts.row.to_pay", "Do zapłaty")}
          </span>
        </button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onDownload(String(record.id), personName, type)}
          disabled={feeMissing}
          title={
            feeMissing
              ? t("contracts.row.pdf_blocked", "Wycena odblokuje umowę PDF")
              : t("contracts.row.download_pdf", "Pobierz umowę PDF")
          }
          aria-label={t("contracts.row.download_pdf", "Pobierz umowę PDF")}
          className="h-9 w-9 shrink-0"
        >
          {feeMissing ? <AlertTriangle size={14} /> : <FileText size={14} />}
        </Button>
      </div>
    </div>
  );
}
