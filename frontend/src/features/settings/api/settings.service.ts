/**
 * @file settings.service.ts
 * @description API service for handling user profile and security settings.
 * Relies on the globally configured Axios instance.
 * @module features/settings/api
 */

import api from "../../../shared/api/api";
import {
  UserMeDTO,
  UpdatePreferencesPayload,
  ChangePasswordPayload,
  ChangeEmailPayload,
} from "../types/settings.dto";

const BASE_URL = "/api/users/me/";

export const settingsService = {
  /**
   * Fetches the current user's core details and preferences.
   */
  getCurrentUser: async (): Promise<UserMeDTO> => {
    const response = await api.get<UserMeDTO>(BASE_URL);
    return response.data;
  },

  /**
   * Updates user profile and preferences.
   */
  updatePreferences: async (
    payload: UpdatePreferencesPayload,
  ): Promise<UserMeDTO> => {
    const response = await api.patch<UserMeDTO>(BASE_URL, payload);
    return response.data;
  },

  /**
   * Securely changes the user's password.
   */
  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await api.post(`${BASE_URL}change-password/`, payload);
  },

  /**
   * Initiates an email change process (requires current password).
   */
  changeEmail: async (payload: ChangeEmailPayload): Promise<UserMeDTO> => {
    const response = await api.post<UserMeDTO>(
      `${BASE_URL}change-email/`,
      payload,
    );
    return response.data;
  },

  exportData: async (): Promise<void> => {
    const response = await api.get(`${BASE_URL}export-data/`, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "voctmanager_export.json");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteAccount: async (): Promise<void> => {
    await api.post(`${BASE_URL}delete-account/`);
  },
};
