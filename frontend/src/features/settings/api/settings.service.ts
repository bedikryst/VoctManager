/**
 * @file settings.service.ts
 * @description API service for handling user profile and security settings.
 * Relies on the globally configured Axios instance.
 * @module features/settings/api
 */

import api from "@/shared/api/api";
import {
  UserMeDTO,
  UserProfileDTO,
  UpdatePreferencesPayload,
  ChangePasswordPayload,
  ChangeEmailPayload,
  DeleteAccountPayload,
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

  deleteAccount: async (payload: DeleteAccountPayload): Promise<void> => {
    await api.post(`${BASE_URL}delete-account/`, payload);
  },
  resetCalendarToken: async (): Promise<{ calendar_token: string }> => {
    const response = await api.post(`${BASE_URL}reset-calendar-token/`);
    return response.data;
  },

  /**
   * Uploads a (client-cropped) avatar. The server re-encodes it and returns the
   * refreshed profile with the new render URLs.
   */
  uploadAvatar: async (file: Blob): Promise<UserProfileDTO> => {
    const formData = new FormData();
    formData.append("avatar", file, "avatar.webp");
    const response = await api.post<UserProfileDTO>(
      `${BASE_URL}avatar/`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  /** Removes the current avatar; returns the refreshed profile. */
  deleteAvatar: async (): Promise<UserProfileDTO> => {
    const response = await api.delete<UserProfileDTO>(`${BASE_URL}avatar/`);
    return response.data;
  },
};
