/**
 * @file auth.service.ts
 * @description Public authentication service operations outside the standard login flow.
 * @module features/auth/api
 */

import api, { type AuthRequestConfig } from "@/shared/api/api";
import type {
  ActivateAccountPayload,
  ActivateAccountResponse,
  ActivationPreviewResponse,
  PasswordResetConfirmPayload,
  PasswordResetConfirmResponse,
  PasswordResetRequestPayload,
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

  /**
   * Read-only: resolves the invited member's display name from a signed
   * activation link so the screen can greet them before they set a password.
   */
  previewActivation: async (params: {
    uidb64: string;
    token: string;
  }): Promise<ActivationPreviewResponse> => {
    const response = await api.get<ActivationPreviewResponse>(
      "/api/users/activate/preview/",
      {
        ...publicAuthRequestConfig,
        params: { uid: params.uidb64, token: params.token },
      },
    );
    return response.data;
  },

  /**
   * Enumeration-safe: the backend always answers 200, so callers must show an
   * identical "if an account exists…" message regardless of the outcome.
   */
  requestPasswordReset: async (
    payload: PasswordResetRequestPayload,
  ): Promise<void> => {
    await api.post("/api/users/password-reset/", payload, publicAuthRequestConfig);
  },

  confirmPasswordReset: async (
    payload: PasswordResetConfirmPayload,
  ): Promise<PasswordResetConfirmResponse> => {
    const response = await api.post<PasswordResetConfirmResponse>(
      "/api/users/password-reset/confirm/",
      payload,
      publicAuthRequestConfig,
    );
    return response.data;
  },
};
