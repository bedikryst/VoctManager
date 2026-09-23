/**
 * @file FeeDetailsSheet.tsx
 * @description The bookkeeping behind one fee — what the office needs and the
 * amount field cannot hold: a due date, the vendor's invoice, a mandate's
 * employer contributions, the valuation of a volunteer's work, a note, and a
 * one-off payee's name and side.
 * It saves as one act. The money fields travel in a single-row pricing batch
 * that restates the stored amount, so a paid or contracted fee still takes its
 * contributions (the server allows exactly that); the rest goes to the item's
 * details. Only what changed is sent.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/FeeDetailsSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useSaveFees, useUpdateCostItemDetails } from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { feeRefOf } from "../../lib/feeDraft";
import { toastFinanceError } from "../../lib/financeErrors";
import { categoryLabel, formLabel } from "../../lib/financePresentation";
import { fromGrosze, sanitizeAmountInput, toAmountInput, toGrosze } from "../../lib/money";
import { isValidNip, normalizeNip } from "../../lib/nip";
import type {
  CostItemDetailsPayload,
  DecimalString,
  FeeCategory,
  FeeItemPayload,
  LedgerRowDTO,
} from "../../types/finance.dto";

interface FeeDetailsSheetProps {
  readonly projectId: string;
  readonly row: LedgerRowDTO;
  readonly onClose: () => void;
}

type FieldErrors = Partial<
  Record<"payee_name" | "employer_contributions" | "in_kind_hours" | "in_kind_hourly_rate" | "vendor_nip", string>
>;

const SIDES: readonly FeeCategory[] = ["PERSONNEL_ARTISTIC", "PERSONNEL_TECHNICAL"];

/** A typed optional amount: `undefined` when it is not an amount at all. */
const parseOptional = (typed: string): DecimalString | null | undefined => {
  if (typed.trim() === "") return null;
  const grosze = toGrosze(typed);
  return grosze === null ? undefined : fromGrosze(grosze);
};

export function FeeDetailsSheet({
  projectId,
  row,
  onClose,
}: FeeDetailsSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const saveFees = useSaveFees(projectId);
  const updateDetails = useUpdateCostItemDetails(projectId);

  const identityEditable =
    row.origin === "one_off" && !row.is_paid && row.contract === null;
  const isMandate = row.form === "ZLECENIE";
  const isVolunteer = row.form === "VOLUNTEER";
  const isInvoice = row.form === "INVOICE";

  const [payeeName, setPayeeName] = useState(row.payee_name);
  const [payeeRole, setPayeeRole] = useState(row.payee_role);
  const [side, setSide] = useState<FeeCategory>(
    row.category === "PERSONNEL_TECHNICAL" ? "PERSONNEL_TECHNICAL" : "PERSONNEL_ARTISTIC",
  );
  const [dueOn, setDueOn] = useState(row.due_on ?? "");
  const [contributions, setContributions] = useState(toAmountInput(row.employer_contributions));
  const [inKindHours, setInKindHours] = useState(toAmountInput(row.in_kind_hours));
  const [inKindRate, setInKindRate] = useState(toAmountInput(row.in_kind_hourly_rate));
  const [documentNumber, setDocumentNumber] = useState(row.document_number);
  const [documentDate, setDocumentDate] = useState(row.document_date ?? "");
  const [vendorNip, setVendorNip] = useState(row.vendor_nip);
  const [note, setNote] = useState(row.note);
  const [errors, setErrors] = useState<FieldErrors>({});

  const isPending = saveFees.isPending || updateDetails.isPending;

  const handleConfirm = async (): Promise<void> => {
    if (!row.cost_item_id) return;
    const nextErrors: FieldErrors = {};
    const notAmount = t("finance.details.not_amount", "To nie jest kwota.");

    const pricing: Partial<Record<"employer_contributions" | "in_kind_hours" | "in_kind_hourly_rate", DecimalString | null>> = {};
    const collect = (
      field: "employer_contributions" | "in_kind_hours" | "in_kind_hourly_rate",
      typed: string,
      stored: DecimalString | null,
    ): void => {
      const parsed = parseOptional(typed);
      if (parsed === undefined) {
        nextErrors[field] = notAmount;
        return;
      }
      // Hours must be above zero; a rate or contributions may be zero.
      if (field === "in_kind_hours" && parsed !== null && toGrosze(parsed) === 0) {
        nextErrors[field] = t("finance.details.hours_positive", "Liczba godzin musi być większa od zera.");
        return;
      }
      const parsedValue = parsed === null ? null : toGrosze(parsed);
      if (parsedValue !== toGrosze(stored)) pricing[field] = parsed;
    };
    if (isMandate) collect("employer_contributions", contributions, row.employer_contributions);
    if (isVolunteer) {
      collect("in_kind_hours", inKindHours, row.in_kind_hours);
      collect("in_kind_hourly_rate", inKindRate, row.in_kind_hourly_rate);
    }

    const details: { -readonly [K in keyof CostItemDetailsPayload]: CostItemDetailsPayload[K] } = {};
    if (identityEditable) {
      if (!payeeName.trim()) {
        nextErrors.payee_name = t("finance.one_off.name_required", "Podaj imię i nazwisko albo nazwę.");
      } else if (payeeName.trim() !== row.payee_name) {
        details.payee_name = payeeName.trim();
      }
      if (payeeRole.trim() !== row.payee_role) details.payee_role = payeeRole.trim();
      if (side !== row.category) details.category = side;
    }
    if ((dueOn || null) !== row.due_on) details.due_on = dueOn || null;
    if (note.trim() !== row.note) details.note = note.trim();
    if (isInvoice) {
      if (documentNumber.trim() !== row.document_number) {
        details.document_number = documentNumber.trim();
      }
      if ((documentDate || null) !== row.document_date) {
        details.document_date = documentDate || null;
      }
      const nip = normalizeNip(vendorNip);
      if (nip && !isValidNip(nip)) {
        nextErrors.vendor_nip = t("finance.details.nip_invalid", "To nie jest poprawny NIP.");
      } else if (nip !== row.vendor_nip) {
        details.vendor_nip = nip;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const hasPricing = Object.keys(pricing).length > 0;
    const hasDetails = Object.keys(details).length > 0;
    if (!hasPricing && !hasDetails) {
      onClose();
      return;
    }

    try {
      if (hasPricing) {
        const item: FeeItemPayload = {
          ref: feeRefOf(row),
          contract_amount: row.contract_amount,
          ...pricing,
        };
        await saveFees.mutateAsync({ items: [item] });
      }
      if (hasDetails) {
        await updateDetails.mutateAsync({ costItemId: row.cost_item_id, payload: details });
      }
      toast.success(t("finance.details.done", "Zapisano szczegóły pozycji."));
      onClose();
    } catch (failure) {
      toastFinanceError(
        failure,
        t,
        t("finance.details.error", "Nie udało się zapisać szczegółów."),
      );
    }
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={t("finance.details.title", "Szczegóły pozycji")}
      subtitle={`${row.payee_name} · ${row.form ? formLabel(t, row.form) : ""}`}
      confirmLabel={t("common.actions.save", "Zapisz")}
      onConfirm={() => void handleConfirm()}
      isPending={isPending}
    >
      {identityEditable && (
        <>
          <Input
            label={t("finance.one_off.name", "Imię i nazwisko lub nazwa")}
            value={payeeName}
            onChange={(event) => setPayeeName(event.target.value)}
            error={errors.payee_name}
            maxLength={200}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t("finance.one_off.role", "Za co")}
              value={payeeRole}
              onChange={(event) => setPayeeRole(event.target.value)}
              maxLength={150}
            />
            <Select
              label={t("finance.one_off.side", "Rodzaj kosztu")}
              value={side}
              onValueChange={(value) => setSide(value as FeeCategory)}
              options={SIDES.map((category) => ({
                value: category,
                label: categoryLabel(t, category),
              }))}
            />
          </div>
        </>
      )}

      {isMandate && (
        <Input
          label={t("finance.details.contributions", "Składki pracodawcy (PLN)")}
          type="text"
          inputMode="decimal"
          placeholder="–"
          value={contributions}
          onChange={(event) => setContributions(sanitizeAmountInput(event.target.value))}
          error={errors.employer_contributions}
          className="tabular-nums"
        />
      )}

      {isVolunteer && (
        <div className="flex flex-col gap-2">
          <Eyebrow color="muted" className="ml-1">
            {t("finance.details.in_kind", "Wycena pracy wolontariusza")}
          </Eyebrow>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("finance.details.in_kind_hours", "Godziny")}
              type="text"
              inputMode="decimal"
              placeholder="–"
              value={inKindHours}
              onChange={(event) => setInKindHours(sanitizeAmountInput(event.target.value))}
              error={errors.in_kind_hours}
              className="tabular-nums"
            />
            <Input
              label={t("finance.details.in_kind_rate", "Stawka za godzinę (PLN)")}
              type="text"
              inputMode="decimal"
              placeholder="–"
              value={inKindRate}
              onChange={(event) => setInKindRate(sanitizeAmountInput(event.target.value))}
              error={errors.in_kind_hourly_rate}
              className="tabular-nums"
            />
          </div>
          <Text size="xs" color="muted">
            {t(
              "finance.details.in_kind_note",
              "To nie koszt: wycena służy jako wkład osobowy we wniosku o grant.",
            )}
          </Text>
        </div>
      )}

      {isInvoice && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t("finance.details.document_number", "Numer faktury")}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            maxLength={100}
          />
          <DateTimeField
            granularity="date"
            clearable
            label={t("finance.details.document_date", "Data faktury")}
            value={documentDate}
            onChange={setDocumentDate}
          />
          <Input
            label={t("finance.details.vendor_nip", "NIP wystawcy")}
            value={vendorNip}
            onChange={(event) => setVendorNip(event.target.value)}
            error={errors.vendor_nip}
            maxLength={20}
          />
        </div>
      )}

      <DateTimeField
        granularity="date"
        clearable
        label={t("finance.details.due_on", "Termin płatności")}
        value={dueOn}
        onChange={setDueOn}
      />

      <Textarea
        label={t("finance.details.note", "Uwagi")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={2000}
      />
    </ActSheet>
  );
}
