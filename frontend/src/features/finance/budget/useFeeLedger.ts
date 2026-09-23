/**
 * @file useFeeLedger.ts
 * @description The Honoraria draft: amounts and forms typed on the rows, the
 * standard rate per roster, the preview they make, and the one atomic save.
 * A settled fee — paid, contracted, or a seat no longer in the cast — takes no
 * draft at all; the server would refuse it, and the row states it instead.
 * The standard rate is a decision about the whole roster, so typing it drops
 * the per-person edits typed before it on that side; one typed afterwards
 * still wins, because the server applies the rate first and the rows after.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/useFeeLedger
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectBudget, useSaveFees } from "../api/finance.queries";
import {
  buildFeeBatch,
  isPriceEditable,
  previewRow,
  repriceableCount,
  sideOf,
  summarizeDraft,
  withAmount,
  withForm,
  type DraftSummary,
  type LedgerSide,
  type RowDraft,
  type RowPreview,
  type StandardRates,
} from "../lib/feeDraft";
import { toastFinanceError } from "../lib/financeErrors";
import { sanitizeAmountInput, toGrosze } from "../lib/money";
import type { FeeForm, LedgerRowDTO, ProjectBudgetDTO } from "../types/finance.dto";

const EMPTY_ROWS: readonly LedgerRowDTO[] = [];

export interface LedgerSections {
  readonly cast: readonly LedgerRowDTO[];
  readonly crew: readonly LedgerRowDTO[];
  readonly oneOff: readonly LedgerRowDTO[];
}

/**
 * Unpriced rows float to the top of their ledger — that is the work still to
 * do. The order reads the SERVER state, never the draft, so a row does not
 * jump out from under the cursor the moment its first digit is typed.
 */
const workFirst = (rows: readonly LedgerRowDTO[]): LedgerRowDTO[] => {
  const needsPrice = (row: LedgerRowDTO): boolean => row.billable && !row.is_priced;
  return [...rows.filter(needsPrice), ...rows.filter((row) => !needsPrice(row))];
};

export interface UseFeeLedgerResult {
  readonly budget: ProjectBudgetDTO | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
  readonly rows: readonly LedgerRowDTO[];
  readonly sections: LedgerSections;
  readonly previewOf: (row: LedgerRowDTO) => RowPreview;
  readonly summary: DraftSummary;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly standardRateOf: (side: LedgerSide) => string;
  readonly isStandardRateInvalid: (side: LedgerSide) => boolean;
  readonly repriceable: (side: LedgerSide) => number;
  readonly setAmount: (row: LedgerRowDTO, value: string) => void;
  readonly setForm: (row: LedgerRowDTO, form: FeeForm) => void;
  readonly setStandardRate: (side: LedgerSide, value: string) => void;
  readonly reset: () => void;
  readonly save: () => Promise<void>;
}

export const useFeeLedger = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseFeeLedgerResult => {
  const { t } = useTranslation();
  const budgetQuery = useProjectBudget(projectId);
  const saveFees = useSaveFees(projectId);

  const rows = budgetQuery.data?.ledger ?? EMPTY_ROWS;
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [rates, setRates] = useState<StandardRates>({});

  const previews = useMemo(
    () => new Map(rows.map((row) => [row.key, previewRow(row, drafts[row.key], rates)])),
    [drafts, rates, rows],
  );

  const previewOf = useCallback(
    (row: LedgerRowDTO): RowPreview =>
      previews.get(row.key) ?? previewRow(row, drafts[row.key], rates),
    [drafts, previews, rates],
  );

  const summary = useMemo(() => summarizeDraft(rows, drafts, rates), [drafts, rates, rows]);

  // A draft that would change nothing is not dirty: typing a figure and then
  // typing the stored one back closes the save bar.
  const isDirty = Object.keys(rates).length > 0 || summary.pending > 0 || summary.invalid > 0;

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  const sections = useMemo<LedgerSections>(
    () => ({
      cast: workFirst(rows.filter((row) => row.origin === "cast")),
      crew: workFirst(rows.filter((row) => row.origin === "crew")),
      oneOff: rows.filter((row) => row.origin === "one_off"),
    }),
    [rows],
  );

  const setAmount = (row: LedgerRowDTO, value: string): void => {
    if (!isPriceEditable(row)) return;
    setDrafts((previous) => ({
      ...previous,
      [row.key]: withAmount(previous[row.key], sanitizeAmountInput(value)),
    }));
  };

  const setForm = (row: LedgerRowDTO, form: FeeForm): void => {
    if (!isPriceEditable(row)) return;
    setDrafts((previous) => ({ ...previous, [row.key]: withForm(previous[row.key], form) }));
  };

  const setStandardRate = (side: LedgerSide, raw: string): void => {
    const value = sanitizeAmountInput(raw);
    const isCleared = value.trim() === "";

    setRates((previous) => {
      const next = { ...previous };
      // Cleared means "no standard rate pending", not "a standard rate of
      // nothing" — otherwise emptying the field leaves the save bar open over
      // an instruction the server would refuse.
      if (isCleared) delete next[side];
      else next[side] = value;
      return next;
    });

    if (!isCleared) {
      setDrafts((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => {
            const row = rows.find((candidate) => candidate.key === key);
            return !row || sideOf(row) !== side;
          }),
        ),
      );
    }
  };

  const reset = (): void => {
    setDrafts({});
    setRates({});
  };

  const save = async (): Promise<void> => {
    if (summary.invalid > 0) {
      toast.error(
        t("finance.draft.invalid_title", "Popraw kwoty"),
        {
          description: t(
            "finance.draft.invalid_description",
            "Pola zaznaczone na czerwono nie zawierają kwoty. Popraw je albo wyczyść.",
          ),
        },
      );
      return;
    }

    const batch = buildFeeBatch(rows, drafts, rates);
    if (!batch.standard_rate && batch.items.length === 0) {
      reset();
      return;
    }

    const toastId = toast.loading(t("finance.draft.saving", "Zapisuję stawki…"));
    try {
      await saveFees.mutateAsync(batch);
      reset();
      toast.success(t("finance.draft.saved", "Zapisano stawki i przeliczono budżet."), {
        id: toastId,
      });
    } catch (error) {
      toastFinanceError(
        error,
        t,
        t("finance.draft.save_error", "Nie udało się zapisać stawek. Nic nie zostało zmienione."),
        toastId,
      );
    }
  };

  return {
    budget: budgetQuery.data,
    isLoading: budgetQuery.isLoading,
    isError: budgetQuery.isError && !budgetQuery.data,
    refetch: () => void budgetQuery.refetch(),
    rows,
    sections,
    previewOf,
    summary,
    isDirty,
    isSaving: saveFees.isPending,
    standardRateOf: (side) => rates[side] ?? "",
    isStandardRateInvalid: (side) => {
      const typed = rates[side];
      return typed !== undefined && toGrosze(typed) === null;
    },
    repriceable: (side) => repriceableCount(rows, side),
    setAmount,
    setForm,
    setStandardRate,
    reset,
    save,
  };
};
