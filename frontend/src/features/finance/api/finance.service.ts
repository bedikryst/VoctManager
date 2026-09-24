/**
 * @file finance.service.ts
 * @description Pure HTTP for `/api/finance/`. Every budget write — fees,
 * expenses, the plan, the funding and its splits, the budget's standing, an
 * expense's files — answers with the whole budget, freshly computed, so the
 * caller replaces its copy instead of reconciling rows; a funding source's
 * writes answer with the source's page. Files (contracts, bills, the CSVs, the
 * contracts ZIP, an expense's attachments, the reports and document notes) are
 * fetched as blobs through the authenticated client and saved from memory:
 * none of them has a public URL.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/api/finance.service
 */

import axios, { type AxiosResponse } from "axios";

import api, { type AuthRequestConfig } from "@/shared/api/api";
import type {
  AllocationSetPayload,
  BudgetLinePayload,
  BudgetLineUpdatePayload,
  ContractsZipStatusDTO,
  CostItemDetailsPayload,
  ExpensePayload,
  ExpenseUpdatePayload,
  FeeBatchPayload,
  FinanceOverviewDTO,
  FundingSourceDTO,
  FundingSourcePayload,
  FundingSourceUpdatePayload,
  HistoryPageDTO,
  IsoDate,
  KosztorysVariant,
  OneOffFeePayload,
  PayablesPageDTO,
  PayablesQuery,
  PayFeesPayload,
  PayPayablesResultDTO,
  ProjectBudgetDTO,
  ProjectFundingPayload,
  ProjectFundingUpdatePayload,
  ReportAudience,
  SignContractPayload,
  SourceDetailDTO,
} from "../types/finance.dto";
import { filenameFromDisposition } from "../lib/contentDisposition";

const BASE = "/api/finance";


/**
 * A refused download answers JSON inside a blob, where the error parser cannot
 * read its `error_code`. Decode it back before rethrowing, so the toast can
 * name the refusal instead of printing a generic failure.
 */
const rethrowWithJsonBody = async (error: unknown): Promise<never> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text());
    } catch {
      // Not JSON: the error stays as it came.
    }
  }
  throw error;
};

const saveResponse = (response: AxiosResponse<Blob>, fallbackName: string): void => {
  const filename = filenameFromDisposition(
    response.headers["content-disposition"],
    fallbackName,
  );

  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Every document is generated from the live ledger, so it never comes from the
 * browser's HTTP cache. `cache: "no-store"` (fetch adapter) bypasses any entry
 * the browser may hold — including an error an earlier server answered with a
 * long max-age — without adding a request header, which a cross-origin API
 * (Vite on :5173 → Django on :8000) would have to allow in a CORS preflight.
 */
const download = async (
  url: string,
  fallbackName: string,
  params?: Record<string, string>,
): Promise<void> => {
  try {
    const response = await api.get<Blob>(url, {
      responseType: "blob",
      params,
      adapter: "fetch",
      fetchOptions: { cache: "no-store" },
    });
    saveResponse(response, fallbackName);
  } catch (error) {
    await rethrowWithJsonBody(error);
  }
};

export const FinanceService = {
  getBudget: async (projectId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.get<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/budget/`,
    );
    return response.data;
  },

  getOverview: async (limit: number, offset: number): Promise<FinanceOverviewDTO> => {
    const response = await api.get<FinanceOverviewDTO>(`${BASE}/overview/`, {
      params: { limit, offset },
    });
    return response.data;
  },

  getPayables: async (query: PayablesQuery): Promise<PayablesPageDTO> => {
    const response = await api.get<PayablesPageDTO>(`${BASE}/payables/`, { params: query });
    return response.data;
  },

  /** All or nothing, across projects and kinds. */
  payPayables: async (payload: PayFeesPayload): Promise<PayPayablesResultDTO> => {
    const response = await api.post<PayPayablesResultDTO>(`${BASE}/payables/pay/`, payload);
    return response.data;
  },

  saveFees: async (
    projectId: string,
    payload: FeeBatchPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.patch<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fees/`,
      payload,
    );
    return response.data;
  },

  createOneOff: async (
    projectId: string,
    payload: OneOffFeePayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fees/one-off/`,
      payload,
    );
    return response.data;
  },

  payFees: async (
    projectId: string,
    payload: PayFeesPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fees/pay/`,
      payload,
    );
    return response.data;
  },

  updateDetails: async (
    costItemId: string,
    payload: CostItemDetailsPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.patch<ProjectBudgetDTO>(
      `${BASE}/cost-items/${costItemId}/`,
      payload,
    );
    return response.data;
  },

  unpay: async (costItemId: string, reason: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/cost-items/${costItemId}/unpay/`,
      { reason },
    );
    return response.data;
  },

  releaseFee: async (costItemId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/cost-items/${costItemId}/release/`,
    );
    return response.data;
  },

  issueContract: async (costItemId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/cost-items/${costItemId}/contract/`,
    );
    return response.data;
  },

  signContract: async (
    contractId: string,
    payload: SignContractPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/contracts/${contractId}/sign/`,
      payload,
    );
    return response.data;
  },

  confirmHours: async (
    contractId: string,
    hoursConfirmed: string,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/contracts/${contractId}/hours/`,
      { hours_confirmed: hoursConfirmed },
    );
    return response.data;
  },

  annulContract: async (
    contractId: string,
    reason: string,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/contracts/${contractId}/annul/`,
      { reason },
    );
    return response.data;
  },

  downloadContract: (contractId: string): Promise<void> =>
    download(`${BASE}/contracts/${contractId}/pdf/`, "Umowa.pdf"),

  downloadBill: (contractId: string): Promise<void> =>
    download(`${BASE}/contracts/${contractId}/bill.pdf`, "Rachunek.pdf"),

  downloadProjectLedger: (projectId: string): Promise<void> =>
    download(`${BASE}/projects/${projectId}/export/ledger.csv`, "Rozliczenie.csv"),

  downloadLedgerRange: (from: IsoDate, to: IsoDate): Promise<void> =>
    download(`${BASE}/export/ledger.csv`, `Rozliczenia-${from}-${to}.csv`, {
      from,
      to,
    }),

  // ── Reports and the grantor's exports ───────────────────────────────────
  // `sourceId` is a funding source's id (not the project funding's): the
  // patron whose money a report shows, or the grant a kosztorys's "z dotacji"
  // column and the document notes read.

  downloadReport: (
    projectId: string,
    audience: ReportAudience,
    sourceId?: string,
  ): Promise<void> =>
    download(
      `${BASE}/projects/${projectId}/report.pdf`,
      audience === "board" ? "Raport-dla-zarzadu.pdf" : "Sprawozdanie-dla-mecenasa.pdf",
      sourceId ? { audience, source: sourceId } : { audience },
    ),

  downloadKosztorys: (
    projectId: string,
    variant: KosztorysVariant,
    sourceId?: string,
  ): Promise<void> =>
    download(
      `${BASE}/projects/${projectId}/export/kosztorys-${variant}.csv`,
      variant === "plan" ? "Kosztorys-plan.csv" : "Kosztorys-wykonanie.csv",
      sourceId ? { source: sourceId } : undefined,
    ),

  downloadDocumentNotes: (projectId: string, sourceId?: string): Promise<void> =>
    download(
      `${BASE}/projects/${projectId}/document-notes.pdf`,
      "Opisy-dokumentow.pdf",
      sourceId ? { source: sourceId } : undefined,
    ),

  savePatronSummary: async (projectId: string, text: string): Promise<ProjectBudgetDTO> => {
    const response = await api.patch<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/budget/`,
      { patron_summary: text },
    );
    return response.data;
  },

  requestContractsZip: async (projectId: string): Promise<string> => {
    const response = await api.post<{ task_id: string }>(
      `${BASE}/projects/${projectId}/contracts/zip/`,
    );
    return response.data.task_id;
  },

  getContractsZipStatus: async (taskId: string): Promise<ContractsZipStatusDTO> => {
    const response = await api.get<ContractsZipStatusDTO>(
      `${BASE}/contracts/zip/${taskId}/`,
    );
    return response.data;
  },

  /** `fileUrl` is the manager-only view the status names, not a media path. */
  downloadContractsZip: (fileUrl: string): Promise<void> =>
    download(fileUrl, "Umowy.zip"),

  // ── Expenses ────────────────────────────────────────────────────────────

  createExpense: async (
    projectId: string,
    payload: ExpensePayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/expenses/`,
      payload,
    );
    return response.data;
  },

  updateExpense: async (
    projectId: string,
    expenseId: string,
    payload: ExpenseUpdatePayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.patch<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/expenses/${expenseId}/`,
      payload,
    );
    return response.data;
  },

  deleteExpense: async (projectId: string, expenseId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.delete<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/expenses/${expenseId}/`,
    );
    return response.data;
  },

  payExpenses: async (
    projectId: string,
    payload: PayFeesPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/expenses/pay/`,
      payload,
    );
    return response.data;
  },

  uploadAttachment: async (costItemId: string, file: File): Promise<ProjectBudgetDTO> => {
    const body = new FormData();
    body.append("cost_item", costItemId);
    body.append("file", file);
    const response = await api.post<ProjectBudgetDTO>(`${BASE}/attachments/`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  deleteAttachment: async (attachmentId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.delete<ProjectBudgetDTO>(
      `${BASE}/attachments/${attachmentId}/`,
    );
    return response.data;
  },

  downloadAttachment: (attachmentId: string, fallbackName: string): Promise<void> =>
    download(`${BASE}/attachments/${attachmentId}/`, fallbackName),

  // ── The plan ────────────────────────────────────────────────────────────

  createLine: async (
    projectId: string,
    payload: BudgetLinePayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/lines/`,
      payload,
    );
    return response.data;
  },

  updateLine: async (
    projectId: string,
    lineId: string,
    payload: BudgetLineUpdatePayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.patch<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/lines/${lineId}/`,
      payload,
    );
    return response.data;
  },

  deleteLine: async (projectId: string, lineId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.delete<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/lines/${lineId}/`,
    );
    return response.data;
  },

  reorderLines: async (
    projectId: string,
    ids: readonly string[],
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/lines/reorder/`,
      { ids },
    );
    return response.data;
  },

  chargeLine: async (projectId: string, lineId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/lines/${lineId}/charge/`,
    );
    return response.data;
  },

  // ── Funding ─────────────────────────────────────────────────────────────

  getSources: async (): Promise<readonly FundingSourceDTO[]> => {
    const response = await api.get<FundingSourceDTO[]>(`${BASE}/funding-sources/`);
    return response.data;
  },

  getSource: async (sourceId: string): Promise<SourceDetailDTO> => {
    const response = await api.get<SourceDetailDTO>(`${BASE}/funding-sources/${sourceId}/`);
    return response.data;
  },

  createSource: async (payload: FundingSourcePayload): Promise<SourceDetailDTO> => {
    const response = await api.post<SourceDetailDTO>(`${BASE}/funding-sources/`, payload);
    return response.data;
  },

  updateSource: async (
    sourceId: string,
    payload: FundingSourceUpdatePayload,
  ): Promise<SourceDetailDTO> => {
    const response = await api.patch<SourceDetailDTO>(
      `${BASE}/funding-sources/${sourceId}/`,
      payload,
    );
    return response.data;
  },

  deleteSource: async (sourceId: string): Promise<void> => {
    await api.delete(`${BASE}/funding-sources/${sourceId}/`);
  },

  addFunding: async (
    projectId: string,
    payload: ProjectFundingPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fundings/`,
      payload,
    );
    return response.data;
  },

  updateFunding: async (
    projectId: string,
    fundingId: string,
    payload: ProjectFundingUpdatePayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.patch<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fundings/${fundingId}/`,
      payload,
    );
    return response.data;
  },

  removeFunding: async (projectId: string, fundingId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.delete<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fundings/${fundingId}/`,
    );
    return response.data;
  },

  chargeFunding: async (
    projectId: string,
    fundingId: string,
    ids: readonly string[],
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/fundings/${fundingId}/charge/`,
      { ids },
    );
    return response.data;
  },

  setLineAllocations: async (
    projectId: string,
    lineId: string,
    payload: AllocationSetPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.put<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/lines/${lineId}/allocations/`,
      payload,
    );
    return response.data;
  },

  setCostAllocations: async (
    costItemId: string,
    payload: AllocationSetPayload,
  ): Promise<ProjectBudgetDTO> => {
    const response = await api.put<ProjectBudgetDTO>(
      `${BASE}/cost-items/${costItemId}/allocations/`,
      payload,
    );
    return response.data;
  },

  // ── The budget's standing and history ───────────────────────────────────

  approveBudget: async (projectId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/budget/approve/`,
    );
    return response.data;
  },

  reopenBudget: async (projectId: string, reason: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/budget/reopen/`,
      { reason },
    );
    return response.data;
  },

  closeBudget: async (projectId: string): Promise<ProjectBudgetDTO> => {
    const response = await api.post<ProjectBudgetDTO>(
      `${BASE}/projects/${projectId}/budget/close/`,
    );
    return response.data;
  },

  getHistory: async (
    projectId: string,
    limit: number,
    offset: number,
  ): Promise<HistoryPageDTO> => {
    const response = await api.get<HistoryPageDTO>(
      `${BASE}/projects/${projectId}/history/`,
      {
        params: { limit, offset },
        // History uses `results` as its own page payload, alongside offset metadata.
        skipUnwrap: true,
      } as AuthRequestConfig,
    );
    return response.data;
  },
};
