/**
 * @file settings.queries.ts
 * @description React Query hooks for managing settings state, caching, and mutations.
 * Integrates directly with i18n to reflect language changes instantly across the UI.
 * @module features/settings/api
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { settingsService } from "./settings.service";
import {
  UpdatePreferencesPayload,
  ChangePasswordPayload,
  ChangeEmailPayload,
  DeleteAccountPayload,
} from "../types/settings.dto";

export const settingsKeys = {
  all: ["settings"] as const,
  data: ["settings", "me"] as const,
};

export const useSettingsData = () => {
  return useQuery({
    queryKey: settingsKeys.data,
    queryFn: settingsService.getCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  return useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) =>
      settingsService.updatePreferences(payload),
    onSuccess: (data) => {
      // 1. Update the local React Query cache optimistically
      queryClient.setQueryData(settingsKeys.data, data);

      // 2. Synchronize the application UI language immediately
      if (data.profile?.language && i18n.language !== data.profile.language) {
        i18n.changeLanguage(data.profile.language);
      }
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      settingsService.changePassword(payload),
  });
};

export const useChangeEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChangeEmailPayload) =>
      settingsService.changeEmail(payload),
    onSuccess: (data) => {
      // Update cache with the new email
      queryClient.setQueryData(settingsKeys.data, data);
    },
  });
};

export const useExportData = () => {
  return useMutation({
    mutationFn: () => settingsService.exportData(),
  });
};

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: (payload: DeleteAccountPayload) =>
      settingsService.deleteAccount(payload),
    onSuccess: () => {
      window.location.href = "/login";
    },
  });
};

export const useResetCalendarToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => settingsService.resetCalendarToken(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.data });
    },
  });
};
