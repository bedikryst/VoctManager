/**
 * @file finance.queries.ts
 * @description Server state for finance. Three rules shape every hook here:
 *  - `persist: false`. Names and fees never rest in the device's persisted
 *    query snapshot; the panel's 24-hour offline paint is for rehearsal
 *    material, not for what the foundation pays whom.
 *  - freshness from `queryPolicy` — a budget changes under other hands (a
 *    singer declines, the office pays), so every mount reconciles.
 *  - every write answers with the whole budget, which replaces the cached one
 *    outright, and marks the portfolio stale. A refused write refetches the
 *    budget instead, since a refusal usually means the copy on screen is old.
 * Nothing here is queued offline: a finance write either reaches the server
 * or visibly does not happen.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/api/finance.queries
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import type {
  CostItemDetailsPayload,
  FeeBatchPayload,
  OneOffFeePayload,
  PayFeesPayload,
  ProjectBudgetDTO,
  SignContractPayload,
} from "../types/finance.dto";
import { FinanceService } from "./finance.service";

export const financeKeys = {
  all: ["finance"] as const,
  budget: (projectId: string) => ["finance", "budget", projectId] as const,
  overviews: ["finance", "overview"] as const,
  overview: (limit: number, offset: number) =>
    ["finance", "overview", limit, offset] as const,
};

const FINANCE_STALE_TIME = 30_000;

const FINANCE_QUERY_OPTIONS = {
  meta: { persist: false },
  staleTime: FINANCE_STALE_TIME,
  ...RECONCILING_REFETCH,
} as const;

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

/** A write whose answer is the project's whole budget. */
const useBudgetWrite = <TVariables>(
  projectId: string,
  write: (variables: TVariables) => Promise<ProjectBudgetDTO>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: write,
    onSuccess: (budget) => {
      queryClient.setQueryData(financeKeys.budget(projectId), budget);
      void queryClient.invalidateQueries({ queryKey: financeKeys.overviews });
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
