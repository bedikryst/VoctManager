/**
 * @file LineSheet.tsx
 * @description Adds or edits one kosztorys line: its category, its name as the
 * grantor's form will read it, and how it is built — quantity, unit and unit
 * cost. The planned amount previews as the fields are typed, in the grosze the
 * server will store; the server computes the stored one.
 * A proposal (the "from the cast" helper) opens here pre-filled and says where
 * its figures came from: nothing is written until the manager saves.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/LineSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useCreateLine, useUpdateLine } from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { toastFinanceError } from "../../lib/financeErrors";
import { categoryLabel, unitLabel } from "../../lib/financePresentation";
import {
  MAX_AMOUNT_GROSZE,
  formatLedgerGrosze,
  fromGrosze,
  lineTotalGrosze,
  sanitizeAmountInput,
  toAmountInput,
  toGrosze,
} from "../../lib/money";
import {
  COST_CATEGORIES,
  PLAN_UNITS,
  type BudgetLinePayload,
  type BudgetLineUpdatePayload,
  type CostCategory,
  type PlanLineDTO,
  type PlanUnit,
} from "../../types/finance.dto";

/** What the form starts from: a stored line, a proposal, or nothing. */
export interface LineDraft {
  readonly category: CostCategory;
  readonly name: string;
  readonly unit: PlanUnit;
  readonly quantity: string;
  readonly unitCost: string;
  readonly note: string;
}

export const EMPTY_LINE: LineDraft = {
  category: "VENUE",
  name: "",
  unit: "SERVICE",
  quantity: "1",
  unitCost: "",
  note: "",
};

export const draftOfLine = (line: PlanLineDTO): LineDraft => ({
  category: line.category,
  name: line.name,
  unit: line.unit,
  quantity: toAmountInput(line.quantity),
  unitCost: toAmountInput(line.unit_cost),
  note: line.note,
});

interface LineSheetProps {
  readonly projectId: string;
  /** The line being edited; absent when adding one. */
  readonly line?: PlanLineDTO;
  readonly initial: LineDraft;
  /** Where a proposal's figures came from, said above the form. */
  readonly proposalNote?: string;
  readonly onClose: () => void;
}

type FieldErrors = Partial<Record<"name" | "quantity" | "unitCost", string>>;

export function LineSheet({
  projectId,
  line,
  initial,
  proposalNote,
  onClose,
}: LineSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const create = useCreateLine(projectId);
  const update = useUpdateLine(projectId);
  const [draft, setDraft] = useState<LineDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = <K extends keyof LineDraft>(key: K, value: LineDraft[K]): void => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const total = lineTotalGrosze(draft.quantity, draft.unitCost);
  const currency = t("common.currency", "PLN");

  const handleConfirm = (): void => {
    const next: FieldErrors = {};
    const quantity = toGrosze(draft.quantity);
    const unitCost = toGrosze(draft.unitCost);
    if (!draft.name.trim()) {
      next.name = t("finance.plan.sheet.name_required", "Podaj nazwę pozycji — taką jak we wniosku.");
    }
    if (quantity === null || quantity <= 0) {
      next.quantity = t("finance.plan.sheet.quantity_invalid", "Podaj ilość większą od zera.");
    }
    if (unitCost === null) {
      next.unitCost = t("finance.plan.sheet.cost_invalid", "To nie jest kwota.");
    } else if (total !== null && total > MAX_AMOUNT_GROSZE) {
      next.unitCost = t("finance.plan.sheet.too_large", "Razem wychodzi więcej, niż mieści budżet.");
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || quantity === null || unitCost === null) return;

    const payload: BudgetLinePayload = {
      category: draft.category,
      name: draft.name.trim(),
      unit: draft.unit,
      quantity: fromGrosze(quantity),
      unit_cost: fromGrosze(unitCost),
      note: draft.note.trim(),
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(
          line
            ? t("finance.plan.sheet.saved", "Zapisano pozycję kosztorysu.")
            : t("finance.plan.sheet.added", "Dodano pozycję kosztorysu."),
        );
        onClose();
      },
      onError: (failure: unknown) =>
        toastFinanceError(
          failure,
          t,
          t("finance.plan.sheet.error", "Nie udało się zapisać pozycji."),
        ),
    };

    if (!line) {
      create.mutate(payload, callbacks);
      return;
    }
    // Only what changed goes out, so an unchanged category never detaches the
    // costs charged to the line.
    const changes: { -readonly [K in keyof BudgetLineUpdatePayload]: BudgetLineUpdatePayload[K] } = {};
    if (payload.category !== line.category) changes.category = payload.category;
    if (payload.name !== line.name) changes.name = payload.name;
    if (payload.unit !== line.unit) changes.unit = payload.unit;
    if (quantity !== toGrosze(line.quantity)) changes.quantity = payload.quantity;
    if (unitCost !== toGrosze(line.unit_cost)) changes.unit_cost = payload.unit_cost;
    if (payload.note !== line.note) changes.note = payload.note;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate({ lineId: line.id, payload: changes }, callbacks);
  };

  const categoryMoves = line !== undefined && draft.category !== line.category && line.cost_count > 0;

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={
        line
          ? t("finance.plan.sheet.edit_title", "Pozycja {{number}}", { number: line.number })
          : t("finance.plan.sheet.add_title", "Nowa pozycja kosztorysu")
      }
      confirmLabel={line ? t("common.actions.save", "Zapisz") : t("finance.plan.sheet.add", "Dodaj")}
      onConfirm={handleConfirm}
      isPending={create.isPending || update.isPending}
    >
      {proposalNote && (
        <Text size="sm" color="graphite">
          {proposalNote}
        </Text>
      )}
      <Select
        label={t("finance.plan.sheet.category", "Rodzaj kosztu")}
        value={draft.category}
        onValueChange={(value) => set("category", value as CostCategory)}
        options={COST_CATEGORIES.map((category) => ({
          value: category,
          label: categoryLabel(t, category),
        }))}
      />
      {categoryMoves && (
        <Caption color="gold">
          {t(
            "finance.plan.sheet.category_detaches",
            "Koszty przypisane do tej pozycji zostaną poza kosztorysem — koszt przypisuje się do pozycji swojego rodzaju.",
          )}
        </Caption>
      )}
      <Input
        label={t("finance.plan.sheet.name", "Nazwa pozycji")}
        placeholder={t("finance.plan.sheet.name_placeholder", "np. Wynajem kościoła")}
        value={draft.name}
        onChange={(event) => set("name", event.target.value)}
        error={errors.name}
        maxLength={200}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Input
          label={t("finance.plan.sheet.quantity", "Ilość")}
          type="text"
          inputMode="decimal"
          value={draft.quantity}
          onChange={(event) => set("quantity", sanitizeAmountInput(event.target.value))}
          error={errors.quantity}
          className="tabular-nums"
        />
        <Select
          label={t("finance.plan.sheet.unit", "Jednostka")}
          value={draft.unit}
          onValueChange={(value) => set("unit", value as PlanUnit)}
          options={PLAN_UNITS.map((unit) => ({ value: unit, label: unitLabel(t, unit) }))}
        />
        <Input
          label={t("finance.plan.sheet.unit_cost", "Cena jednostkowa (PLN)")}
          type="text"
          inputMode="decimal"
          placeholder="–"
          value={draft.unitCost}
          onChange={(event) => set("unitCost", sanitizeAmountInput(event.target.value))}
          error={errors.unitCost}
          className="col-span-2 tabular-nums sm:col-span-1"
        />
      </div>
      <Text size="sm" color="graphite" className="tabular-nums">
        {t("finance.plan.sheet.total", "Razem: {{amount}} {{currency}}", {
          amount: total === null ? "–" : formatLedgerGrosze(Number(total)),
          currency,
        })}
      </Text>
      <Textarea
        label={t("finance.plan.sheet.note", "Uwagi")}
        value={draft.note}
        onChange={(event) => set("note", event.target.value)}
        rows={2}
        maxLength={2000}
      />
    </ActSheet>
  );
}
