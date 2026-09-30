/**
 * @file ExpenseSheet.tsx
 * @description Books or corrects one expense from the vendor's document: who,
 * for what, which document, its gross — the foundation's cost, since no VAT is
 * recovered — and the plan line it is charged to. Adding one charges it to the
 * only line of its category when the plan has exactly one; the choice stays in
 * view and can be changed before saving.
 * On a paid expense the amount and the vendor are what the office paid, so
 * they are read-only here; the board reverts the payment to change them.
 * The date the cost is incurred on — which grant eligibility is judged by — is
 * never typed: the server takes the document's date, or the concert day until
 * there is one, and the sheet says which.
 * A vendor who gives no document (lodging at a religious house) is booked as
 * "no document": the number and date fields leave, and what was paid for
 * becomes required, since the office books it from the payer's description.
 * A receipt says whether it bears the foundation's NIP.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/ExpenseSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useCreateExpense, useUpdateExpense } from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { PlanLineSelect } from "../../components/PlanLineSelect";
import { toastFinanceError } from "../../lib/financeErrors";
import { categoryLabel, documentTypeLabel, formatFinanceDate } from "../../lib/financePresentation";
import { fromGrosze, sanitizeAmountInput, toAmountInput, toGrosze } from "../../lib/money";
import { isValidNip, normalizeNip } from "../../lib/nip";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_DOCUMENT_TYPES,
  type CostCategory,
  type ExpenseDocumentType,
  type ExpensePayload,
  type ExpenseRowDTO,
  type ExpenseUpdatePayload,
  type PlanLineDTO,
} from "../../types/finance.dto";

interface ExpenseSheetProps {
  readonly projectId: string;
  /** The expense being corrected; absent when booking a new one. */
  readonly expense?: ExpenseRowDTO;
  readonly lines: readonly PlanLineDTO[];
  readonly onClose: () => void;
}

type FieldErrors = Partial<Record<"vendor" | "description" | "nip" | "amount", string>>;

/** A receipt with the buyer's NIP stands for an invoice only up to this gross (VAT act, simplified invoice). */
const SIMPLIFIED_INVOICE_LIMIT_GROSZE = 45_000;

/** The line a new cost of this category goes to: the plan's only one of it. */
const soleLineOf = (lines: readonly PlanLineDTO[], category: CostCategory): string => {
  const matching = lines.filter((line) => line.category === category);
  return matching.length === 1 ? matching[0].id : "";
};

export function ExpenseSheet({
  projectId,
  expense,
  lines,
  onClose,
}: ExpenseSheetProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const create = useCreateExpense(projectId);
  const update = useUpdateExpense(projectId);
  const isPaid = expense?.is_paid ?? false;

  const initialCategory: CostCategory = expense?.category ?? "VENUE";
  const [category, setCategory] = useState<CostCategory>(initialCategory);
  const [lineId, setLineId] = useState(
    expense ? (expense.budget_line_id ?? "") : soleLineOf(lines, initialCategory),
  );
  const [vendor, setVendor] = useState(expense?.vendor_name ?? "");
  const [nip, setNip] = useState(expense?.vendor_nip ?? "");
  const [documentType, setDocumentType] = useState<ExpenseDocumentType>(
    expense?.document_type || "INVOICE",
  );
  const [buyerNip, setBuyerNip] = useState(expense?.receipt_has_buyer_nip ?? false);
  const [documentNumber, setDocumentNumber] = useState(expense?.document_number ?? "");
  const [documentDate, setDocumentDate] = useState(expense?.document_date ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? toAmountInput(expense.cost_amount) : "");
  const [dueOn, setDueOn] = useState(expense?.due_on ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});

  const categoryLines = lines.filter((line) => line.category === category);
  const isUndocumented = documentType === "NONE";
  const isReceipt = documentType === "RECEIPT";
  const typedGrosze = toGrosze(amount);
  const receiptOverInvoiceLimit =
    isReceipt && buyerNip && typedGrosze !== null && typedGrosze > SIMPLIFIED_INVOICE_LIMIT_GROSZE;

  const changeCategory = (next: CostCategory): void => {
    setCategory(next);
    // A cost is charged to a line of its own category, so the line follows.
    setLineId(soleLineOf(lines, next));
  };

  const handleConfirm = (): void => {
    const nextErrors: FieldErrors = {};
    if (!vendor.trim()) {
      nextErrors.vendor = t("finance.expenses.sheet.vendor_required", "Podaj, komu fundacja płaci.");
    }
    if (isUndocumented && !description.trim()) {
      nextErrors.description = t(
        "finance.expenses.sheet.description_required",
        "Bez dokumentu napisz, za co fundacja zapłaciła.",
      );
    }
    const normalizedNip = normalizeNip(nip);
    if (normalizedNip && !isValidNip(normalizedNip)) {
      nextErrors.nip = t("finance.details.nip_invalid", "To nie jest poprawny NIP.");
    }
    const grosze = toGrosze(amount);
    if (grosze === null || grosze <= 0) {
      nextErrors.amount = isUndocumented
        ? t("finance.expenses.sheet.amount_invalid_undocumented", "Podaj kwotę, którą fundacja zapłaciła.")
        : t("finance.expenses.sheet.amount_invalid", "Podaj kwotę brutto z dokumentu.");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || grosze === null) return;

    // No document sends no number or date. What was typed stays in state, so
    // switching the type back restores it.
    const payload: ExpensePayload = {
      category,
      budget_line: lineId || null,
      vendor_name: vendor.trim(),
      vendor_nip: normalizedNip,
      document_type: documentType,
      receipt_has_buyer_nip: isReceipt && buyerNip,
      document_number: isUndocumented ? "" : documentNumber.trim(),
      document_date: isUndocumented ? null : documentDate || null,
      description: description.trim(),
      cost_amount: fromGrosze(grosze),
      due_on: dueOn || null,
      note: note.trim(),
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(
          expense
            ? t("finance.expenses.sheet.saved", "Zapisano wydatek.")
            : t("finance.expenses.sheet.added", "Dodano wydatek: {{vendor}}.", {
                vendor: payload.vendor_name,
              }),
        );
        onClose();
      },
      onError: (failure: unknown) =>
        toastFinanceError(
          failure,
          t,
          t("finance.expenses.sheet.error", "Nie udało się zapisać wydatku."),
        ),
    };

    if (!expense) {
      create.mutate(payload, callbacks);
      return;
    }
    const changes: { -readonly [K in keyof ExpenseUpdatePayload]: ExpenseUpdatePayload[K] } = {};
    if (payload.category !== expense.category) changes.category = payload.category;
    if (payload.budget_line !== expense.budget_line_id) changes.budget_line = payload.budget_line;
    if (payload.vendor_name !== expense.vendor_name) changes.vendor_name = payload.vendor_name;
    if (payload.vendor_nip !== expense.vendor_nip) changes.vendor_nip = payload.vendor_nip;
    if (payload.document_type !== expense.document_type) changes.document_type = payload.document_type;
    if (payload.receipt_has_buyer_nip !== expense.receipt_has_buyer_nip) {
      changes.receipt_has_buyer_nip = payload.receipt_has_buyer_nip;
    }
    if (payload.document_number !== expense.document_number) {
      changes.document_number = payload.document_number;
    }
    if (payload.document_date !== expense.document_date) changes.document_date = payload.document_date;
    if (payload.description !== expense.description) changes.description = payload.description;
    if (grosze !== toGrosze(expense.cost_amount)) changes.cost_amount = payload.cost_amount;
    if (payload.due_on !== expense.due_on) changes.due_on = payload.due_on;
    if (payload.note !== expense.note) changes.note = payload.note;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate({ expenseId: expense.id, payload: changes }, callbacks);
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={
        expense
          ? t("finance.expenses.sheet.edit_title", "Wydatek")
          : t("finance.expenses.sheet.add_title", "Nowy wydatek")
      }
      subtitle={expense?.vendor_name}
      confirmLabel={
        expense ? t("common.actions.save", "Zapisz") : t("finance.expenses.sheet.add", "Dodaj")
      }
      onConfirm={handleConfirm}
      isPending={create.isPending || update.isPending}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t("finance.expenses.sheet.category", "Rodzaj kosztu")}
          value={category}
          onValueChange={(value) => changeCategory(value as CostCategory)}
          options={EXPENSE_CATEGORIES.map((option) => ({
            value: option,
            label: categoryLabel(t, option),
          }))}
        />
        {categoryLines.length > 0 ? (
          <PlanLineSelect lines={categoryLines} value={lineId} onChange={setLineId} />
        ) : (
          <Caption color="muted" className="self-end pb-3">
            {lines.length > 0
              ? t("finance.expenses.sheet.no_line", "Kosztorys nie ma pozycji tego rodzaju.")
              : t("finance.expenses.sheet.no_plan", "Budżet nie ma jeszcze kosztorysu.")}
          </Caption>
        )}
      </div>
      <Input
        label={t("finance.expenses.sheet.vendor", "Odbiorca (firma lub osoba)")}
        value={vendor}
        onChange={(event) => {
          setVendor(event.target.value);
          setErrors((previous) => ({ ...previous, vendor: undefined }));
        }}
        error={errors.vendor}
        disabled={isPaid}
        maxLength={200}
      />
      <Input
        label={t("finance.expenses.sheet.description", "Za co")}
        placeholder={t("finance.expenses.sheet.description_placeholder", "np. wynajem kościoła na koncert")}
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
          setErrors((previous) => ({ ...previous, description: undefined }));
        }}
        error={errors.description}
        maxLength={300}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t("finance.expenses.sheet.document_type", "Dokument")}
          value={documentType}
          onValueChange={(value) => {
            setDocumentType(value as ExpenseDocumentType);
            setErrors((previous) => ({ ...previous, description: undefined }));
          }}
          options={EXPENSE_DOCUMENT_TYPES.map((type) => ({
            value: type,
            label: documentTypeLabel(t, type),
          }))}
        />
        {!isUndocumented && (
          <>
            <Input
              label={t("finance.expenses.sheet.document_number", "Numer dokumentu")}
              value={documentNumber}
              onChange={(event) => setDocumentNumber(event.target.value)}
              maxLength={100}
            />
            <DateTimeField
              granularity="date"
              clearable
              label={t("finance.expenses.sheet.document_date", "Data dokumentu")}
              value={documentDate}
              onChange={setDocumentDate}
            />
          </>
        )}
        <Input
          label={t("finance.details.vendor_nip", "NIP wystawcy")}
          value={nip}
          onChange={(event) => {
            setNip(event.target.value);
            setErrors((previous) => ({ ...previous, nip: undefined }));
          }}
          error={errors.nip}
          maxLength={20}
        />
      </div>
      {isReceipt && (
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox checked={buyerNip} onChange={() => setBuyerNip((previous) => !previous)} />
          <Text as="span" size="sm">
            {t("finance.expenses.sheet.receipt_buyer_nip", "Paragon z NIP fundacji")}
          </Text>
        </label>
      )}
      {receiptOverInvoiceLimit && (
        <Caption color="gold">
          {t(
            "finance.expenses.sheet.receipt_over_limit",
            "Powyżej 450 zł paragon z NIP nie zastępuje faktury. Poproś sprzedawcę o fakturę na fundację.",
          )}
        </Caption>
      )}
      <Caption color="muted">
        {isUndocumented
          ? t(
              "finance.expenses.sheet.undocumented_hint",
              "Bez dokumentu biuro zwykle księguje wydatek na podstawie opisu podpisanego przez osobę, która płaciła (dowód zastępczy). Dlatego „Za co” jest obowiązkowe. Datą kosztu jest dzień koncertu.",
            )
          : documentDate
          ? t(
              "finance.expenses.sheet.incurred_document",
              "Data kosztu: {{date}}, data dokumentu. Według niej ocenia się kwalifikowalność w dotacji.",
              { date: formatFinanceDate(documentDate, i18n.language) },
            )
          : t(
              "finance.expenses.sheet.incurred_concert",
              "Data kosztu: dzień koncertu, dopóki nie wpiszesz daty dokumentu. Według niej ocenia się kwalifikowalność w dotacji.",
            )}
      </Caption>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("finance.expenses.sheet.amount", "Kwota brutto (PLN)")}
          type="text"
          inputMode="decimal"
          placeholder="–"
          value={amount}
          onChange={(event) => {
            setAmount(sanitizeAmountInput(event.target.value));
            setErrors((previous) => ({ ...previous, amount: undefined }));
          }}
          error={errors.amount}
          disabled={isPaid}
          className="tabular-nums"
        />
        <DateTimeField
          granularity="date"
          clearable
          label={t("finance.details.due_on", "Termin płatności")}
          value={dueOn}
          onChange={setDueOn}
        />
      </div>
      {isPaid && (
        <Caption color="muted">
          {t(
            "finance.expenses.sheet.paid_lock",
            "Wydatek jest zapłacony: kwoty i odbiorcy nie zmienisz bez cofnięcia zapłaty przez zarząd.",
          )}
        </Caption>
      )}
      <Textarea
        label={t("finance.details.note", "Uwagi")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        maxLength={2000}
      />
    </ActSheet>
  );
}
