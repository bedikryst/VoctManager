/**
 * @file finance.queries.ts
 * @description Server state for finance. Three rules shape every hook here:
 *  - `MONEY_QUERY_OPTIONS` from `queryPolicy`: never persisted to the device,
 *    and reconciled on every mount — a budget changes under other hands (a
 *    singer declines, the office pays).
 *  - every write answers with the whole budget, which replaces the cached one
 *    outright (cancelling a read still in flight), and marks the portfolio,
 *    the funding sources (whose figures sum every project), the budget's
 *    history and the artists' dossiers (whose totals sum the ledger) stale. A
 *    refused write refetches the budget instead, since a refusal usually
 *    means the copy on screen is old. A source's own write marks every budget
 *    stale: each one embeds it.
 * Nothing here is queued offline: a finance write either reaches the server
 * or visibly does not happen.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/api/finance.queries
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  MONEY_QUERY_OPTIONS,
  MONEY_READMODEL_KEYS,
  invalidateArtistDossiers,
} from "@/shared/api/queryPolicy";
import type {
  AllocationSetPayload,
  BudgetLinePayload,
  BudgetLineUpdatePayload,
  CostItemDetailsPayload,
  ExpensePayload,
  ExpenseUpdatePayload,
  FeeBatchPayload,
  FundingSourcePayload,
  FundingSourceUpdatePayload,
  OneOffFeePayload,
  PayFeesPayload,
  ProjectBudgetDTO,
  ProjectFundingPayload,
  ProjectFundingUpdatePayload,
  SignContractPayload,
  SourceDetailDTO,
} from "../types/finance.dto";
import { FinanceService } from "./finance.service";

export const financeKeys = {
  all: ["finance"] as const,
  budgets: ["finance", "budget"] as const,
  budget: MONEY_READMODEL_KEYS.budget,
  overviews: ["finance", "overview"] as const,
  overview: (limit: number, offset: number) =>
    ["finance", "overview", limit, offset] as const,
  history: (projectId: string) => ["finance", "history", projectId] as const,
  /** The list and every source's page — one prefix, so one invalidation. */
  sources: ["finance", "sources"] as const,
  sourceList: ["finance", "sources", "list"] as const,
  source: (sourceId: string) => ["finance", "sources", "detail", sourceId] as const,
};

const FINANCE_QUERY_OPTIONS = MONEY_QUERY_OPTIONS;

/**
 * Puts a write's answer in the cache, over whatever read is still in flight: a
 * focus refetch that left before the write would otherwise land after it and
 * paint the old figures. Only where a query already holds the key — one made
 * by `setQueryData` alone carries no `persist: false`, and the persister would
 * keep it; an absent query fetches on its own when it mounts.
 */
const replaceCached = async <TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  data: TData,
): Promise<void> => {
  if (!queryClient.getQueryCache().find({ queryKey, exact: true })) return;
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueryData(queryKey, data);
};

export const useProjectBudget = (projectId: string) =>
  useQuery({
    queryKey: financeKeys.budget(projectId),
    queryFn: () => FinanceService.getBudget(projectId),
    enabled: Boolean(projectId),
    ...FINANCE_QUERY_OPTIONS,
  });

export const PAYABLES_PAGE_SIZE = 50;

export const useFinanceOverview = (offset: number) =>
  useQuery({
    queryKey: financeKeys.overview(PAYABLES_PAGE_SIZE, offset),
    queryFn: () => FinanceService.getOverview(PAYABLES_PAGE_SIZE, offset),
    placeholderData: keepPreviousData,
    ...FINANCE_QUERY_OPTIONS,
  });

export const useFundingSources = () =>
  useQuery({
    queryKey: financeKeys.sourceList,
    queryFn: FinanceService.getSources,
    ...FINANCE_QUERY_OPTIONS,
  });

export const useFundingSource = (sourceId: string) =>
  useQuery({
    queryKey: financeKeys.source(sourceId),
    queryFn: () => FinanceService.getSource(sourceId),
    enabled: Boolean(sourceId),
    ...FINANCE_QUERY_OPTIONS,
  });

const HISTORY_PAGE_SIZE = 20;

/**
 * The budget's history, newest first, a page at a time. A write invalidates it
 * whole, so every loaded page is refetched from the top and none drifts by the
 * acts that landed above it.
 */
export const useBudgetHistory = (projectId: string) =>
  useInfiniteQuery({
    queryKey: financeKeys.history(projectId),
    queryFn: ({ pageParam }) => FinanceService.getHistory(projectId, HISTORY_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.limit < last.count ? last.offset + last.limit : undefined,
    enabled: Boolean(projectId),
    ...FINANCE_QUERY_OPTIONS,
  });

/** A write whose answer is the project's whole budget. */
const useBudgetWrite = <TVariables>(
  projectId: string,
  write: (variables: TVariables) => Promise<ProjectBudgetDTO>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: write,
    onSuccess: async (budget) => {
      await replaceCached(queryClient, financeKeys.budget(projectId), budget);
      void queryClient.invalidateQueries({ queryKey: financeKeys.overviews });
      void queryClient.invalidateQueries({ queryKey: financeKeys.sources });
      void queryClient.invalidateQueries({ queryKey: financeKeys.history(projectId) });
      invalidateArtistDossiers(queryClient);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.budget(projectId) });
    },
  });
};

export const useSaveFees = (projectId: string) =>
  useBudgetWrite(projectId, (payload: FeeBatchPayload) =>
    FinanceService.saveFees(projectId, payload),
  );

export const useCreateOneOff = (projectId: string) =>
  useBudgetWrite(projectId, (payload: OneOffFeePayload) =>
    FinanceService.createOneOff(projectId, payload),
  );

export const usePayFees = (projectId: string) =>
  useBudgetWrite(projectId, (payload: PayFeesPayload) =>
    FinanceService.payFees(projectId, payload),
  );

export const useUpdateCostItemDetails = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ costItemId, payload }: { costItemId: string; payload: CostItemDetailsPayload }) =>
      FinanceService.updateDetails(costItemId, payload),
  );

export const useUnpay = (projectId: string) =>
  useBudgetWrite(projectId, ({ costItemId, reason }: { costItemId: string; reason: string }) =>
    FinanceService.unpay(costItemId, reason),
  );

export const useReleaseFee = (projectId: string) =>
  useBudgetWrite(projectId, (costItemId: string) => FinanceService.releaseFee(costItemId));

export const useIssueContract = (projectId: string) =>
  useBudgetWrite(projectId, (costItemId: string) =>
    FinanceService.issueContract(costItemId),
  );

export const useSignContract = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ contractId, payload }: { contractId: string; payload: SignContractPayload }) =>
      FinanceService.signContract(contractId, payload),
  );

export const useConfirmHours = (projectId: string) =>
  useBudgetWrite(projectId, ({ contractId, hours }: { contractId: string; hours: string }) =>
    FinanceService.confirmHours(contractId, hours),
  );

export const useAnnulContract = (projectId: string) =>
  useBudgetWrite(projectId, ({ contractId, reason }: { contractId: string; reason: string }) =>
    FinanceService.annulContract(contractId, reason),
  );

// ── Expenses ──────────────────────────────────────────────────────────────

export const useCreateExpense = (projectId: string) =>
  useBudgetWrite(projectId, (payload: ExpensePayload) =>
    FinanceService.createExpense(projectId, payload),
  );

export const useUpdateExpense = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ expenseId, payload }: { expenseId: string; payload: ExpenseUpdatePayload }) =>
      FinanceService.updateExpense(projectId, expenseId, payload),
  );

export const useDeleteExpense = (projectId: string) =>
  useBudgetWrite(projectId, (expenseId: string) =>
    FinanceService.deleteExpense(projectId, expenseId),
  );

export const usePayExpenses = (projectId: string) =>
  useBudgetWrite(projectId, (payload: PayFeesPayload) =>
    FinanceService.payExpenses(projectId, payload),
  );

export const useUploadAttachment = (projectId: string) =>
  useBudgetWrite(projectId, ({ costItemId, file }: { costItemId: string; file: File }) =>
    FinanceService.uploadAttachment(costItemId, file),
  );

export const useDeleteAttachment = (projectId: string) =>
  useBudgetWrite(projectId, (attachmentId: string) =>
    FinanceService.deleteAttachment(attachmentId),
  );

// ── The plan ──────────────────────────────────────────────────────────────

export const useCreateLine = (projectId: string) =>
  useBudgetWrite(projectId, (payload: BudgetLinePayload) =>
    FinanceService.createLine(projectId, payload),
  );

export const useUpdateLine = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ lineId, payload }: { lineId: string; payload: BudgetLineUpdatePayload }) =>
      FinanceService.updateLine(projectId, lineId, payload),
  );

export const useDeleteLine = (projectId: string) =>
  useBudgetWrite(projectId, (lineId: string) => FinanceService.deleteLine(projectId, lineId));

export const useReorderLines = (projectId: string) =>
  useBudgetWrite(projectId, (ids: readonly string[]) =>
    FinanceService.reorderLines(projectId, ids),
  );

export const useChargeLine = (projectId: string) =>
  useBudgetWrite(projectId, (lineId: string) => FinanceService.chargeLine(projectId, lineId));

// ── Funding ───────────────────────────────────────────────────────────────

export const useAddFunding = (projectId: string) =>
  useBudgetWrite(projectId, (payload: ProjectFundingPayload) =>
    FinanceService.addFunding(projectId, payload),
  );

export const useUpdateFunding = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ fundingId, payload }: { fundingId: string; payload: ProjectFundingUpdatePayload }) =>
      FinanceService.updateFunding(projectId, fundingId, payload),
  );

export const useRemoveFunding = (projectId: string) =>
  useBudgetWrite(projectId, (fundingId: string) =>
    FinanceService.removeFunding(projectId, fundingId),
  );

export const useChargeFunding = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ fundingId, ids }: { fundingId: string; ids: readonly string[] }) =>
      FinanceService.chargeFunding(projectId, fundingId, ids),
  );

export const useSetLineAllocations = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ lineId, payload }: { lineId: string; payload: AllocationSetPayload }) =>
      FinanceService.setLineAllocations(projectId, lineId, payload),
  );

export const useSetCostAllocations = (projectId: string) =>
  useBudgetWrite(
    projectId,
    ({ costItemId, payload }: { costItemId: string; payload: AllocationSetPayload }) =>
      FinanceService.setCostAllocations(costItemId, payload),
  );

/**
 * A write to a funding source itself. Its answer is the source's page; every
 * budget embeds the source, so they are all marked stale with the portfolio.
 */
const useSourceWrite = <TVariables>(
  write: (variables: TVariables) => Promise<SourceDetailDTO>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: write,
    onSuccess: async (detail) => {
      await replaceCached(queryClient, financeKeys.source(detail.source.id), detail);
      void queryClient.invalidateQueries({ queryKey: financeKeys.sourceList });
      void queryClient.invalidateQueries({ queryKey: financeKeys.budgets });
      void queryClient.invalidateQueries({ queryKey: financeKeys.overviews });
    },
  });
};

export const useCreateSource = () =>
  useSourceWrite((payload: FundingSourcePayload) => FinanceService.createSource(payload));

export const useUpdateSource = () =>
  useSourceWrite(
    ({ sourceId, payload }: { sourceId: string; payload: FundingSourceUpdatePayload }) =>
      FinanceService.updateSource(sourceId, payload),
  );

export const useDeleteSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => FinanceService.deleteSource(sourceId),
    onSuccess: (_, sourceId) => {
      queryClient.removeQueries({ queryKey: financeKeys.source(sourceId) });
      void queryClient.invalidateQueries({ queryKey: financeKeys.sourceList });
      void queryClient.invalidateQueries({ queryKey: financeKeys.overviews });
    },
  });
};

// ── The budget's standing ─────────────────────────────────────────────────

export const useApproveBudget = (projectId: string) =>
  useBudgetWrite<void>(projectId, () => FinanceService.approveBudget(projectId));

export const useReopenBudget = (projectId: string) =>
  useBudgetWrite(projectId, (reason: string) => FinanceService.reopenBudget(projectId, reason));

export const useCloseBudget = (projectId: string) =>
  useBudgetWrite<void>(projectId, () => FinanceService.closeBudget(projectId));

export const useSavePatronSummary = (projectId: string) =>
  useBudgetWrite(projectId, (text: string) =>
    FinanceService.savePatronSummary(projectId, text),
  );

// ── The contracts ZIP ─────────────────────────────────────────────────────

export type ZipExportState = "idle" | "working";

const ZIP_POLL_INTERVAL_MS = 2000;
// ~2 minutes: a stalled or absent Celery worker must end in a stated failure,
// not a button that spins for the rest of the session.
const ZIP_MAX_POLLS = 60;

export class ZipExportError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/**
 * Packs the project's issued contracts on the server, waits for the task and
 * saves the archive. Resolves once the file is saved; rejects with a
 * `ZipExportError` naming the refusal (`no_contracts`, `zip_failed`,
 * `zip_timeout`) or with the transport error itself.
 */
export const useContractsZip = (projectId: string) => {
  const [state, setState] = useState<ZipExportState>("idle");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const run = useCallback(async (): Promise<number> => {
    setState("working");
    try {
      const taskId = await FinanceService.requestContractsZip(projectId);
      for (let poll = 0; poll < ZIP_MAX_POLLS; poll += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, ZIP_POLL_INTERVAL_MS));
        if (cancelledRef.current) return 0;

        const status = await FinanceService.getContractsZipStatus(taskId);
        if (status.state === "SUCCESS" && status.file_url) {
          await FinanceService.downloadContractsZip(status.file_url);
          return status.count ?? 0;
        }
        if (status.state === "FAILURE") {
          throw new ZipExportError(status.error_code ?? "zip_failed");
        }
      }
      throw new ZipExportError("zip_timeout");
    } finally {
      if (!cancelledRef.current) setState("idle");
    }
  }, [projectId]);

  return { state, run };
};
