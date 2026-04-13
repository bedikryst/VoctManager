/**
 * @file auth.service.ts
 * @description Public authentication service operations outside the standard login flow.
 * @module features/auth/api
 */

import api, { type AuthRequestConfig } from "@/shared/api/api";
import type {
  ActivateAccountPayload,
  ActivateAccountResponse,
} from "../types/auth.dto";

const publicAuthRequestConfig: AuthRequestConfig = {
  skipAuthRefresh: true,
  skipAuthRedirect: true,
};

export const authService = {
  activateAccount: async (
    payload: ActivateAccountPayload,
  ): Promise<ActivateAccountResponse> => {
    const response = await api.post<ActivateAccountResponse>(
      "/api/users/activate/",
      payload,
      publicAuthRequestConfig,
    );
    return response.data;
  },
};
