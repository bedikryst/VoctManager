/**
 * @file finance.service.ts
 * @description Pure HTTP for `/api/finance/`. Every ledger write answers with
 * the whole budget, freshly computed, so the caller replaces its copy instead
 * of reconciling rows. Documents (contracts, bills, the CSV, the contracts
 * ZIP) are fetched as blobs through the authenticated client and saved from
 * memory: none of them has a public URL, and the ZIP in particular is streamed
 * by a manager-only view.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/api/finance.service
 */

import axios, { type AxiosResponse } from "axios";

import api from "@/shared/api/api";
import type {
  ContractsZipStatusDTO,
  CostItemDetailsPayload,
  FeeBatchPayload,
  FinanceOverviewDTO,
  IsoDate,
  OneOffFeePayload,
  PayFeesPayload,
  ProjectBudgetDTO,
  SignContractPayload,
} from "../types/finance.dto";

const BASE = "/api/finance";

const FILENAME_PATTERN = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;

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
  const disposition: unknown = response.headers["content-disposition"];
  const match =
    typeof disposition === "string" ? FILENAME_PATTERN.exec(disposition) : null;
  const filename = match?.[1] ? match[1].replace(/['"]/g, "") : fallbackName;

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

const download = async (
  url: string,
  fallbackName: string,
  params?: Record<string, string>,
): Promise<void> => {
  try {
    const response = await api.get<Blob>(url, { responseType: "blob", params });
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
};
