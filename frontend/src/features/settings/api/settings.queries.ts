/**
 * @file settings.queries.ts
 * @description React Query hooks for managing settings state, caching, and mutations.
 * Integrates directly with i18n to reflect language changes instantly across the UI.
 * @module features/settings/api
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { changeAppLanguage } from "@/shared/config/i18n";
import { settingsService } from "./settings.service";
import {
  UpdatePreferencesPayload,
  DigestSettingsPayload,
  ChangePasswordPayload,
  ChangeEmailPayload,
  DeleteAccountPayload,
  UserMeDTO,
  UserProfileDTO,
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

  return useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) =>
      settingsService.updatePreferences(payload),
    onSuccess: (data) => {
      // 1. Update the local React Query cache optimistically
      queryClient.setQueryData(settingsKeys.data, data);

      // 2. Adopt the saved language across the UI (and <html lang>). The backend
      //    now holds this preference, so notifications follow automatically.
      if (data.profile?.language) {
        changeAppLanguage(data.profile.language);
      }
    },
  });
};

export const useUpdateDigestSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DigestSettingsPayload) =>
      settingsService.updateDigestSettings(payload),
    onMutate: async (payload) => {
      // Optimistic: the switch/select should feel instant.
      await queryClient.cancelQueries({ queryKey: settingsKeys.data });
      const previous = queryClient.getQueryData<UserMeDTO>(settingsKeys.data);
      if (previous?.profile) {
        queryClient.setQueryData<UserMeDTO>(settingsKeys.data, {
          ...previous,
          profile: { ...previous.profile, ...payload },
        });
      }
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(settingsKeys.data, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.data, data);
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

/**
 * Propagates an avatar change everywhere it is shown: the settings cache, the
 * roster (cards/rows derive from the artist list) and the global auth user that
 * feeds the panel shell.
 */
const useAvatarPropagation = () => {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return async (profile: UserProfileDTO) => {
    queryClient.setQueryData<UserMeDTO>(settingsKeys.data, (prev) =>
      prev ? { ...prev, profile } : prev,
    );
    queryClient.invalidateQueries({ queryKey: settingsKeys.data });
    queryClient.invalidateQueries({ queryKey: ["artists"] });
    await refreshUser();
  };
};

export const useUploadAvatar = () => {
  const propagate = useAvatarPropagation();
  return useMutation({
    mutationFn: (file: Blob) => settingsService.uploadAvatar(file),
    onSuccess: propagate,
  });
};

export const useDeleteAvatar = () => {
  const propagate = useAvatarPropagation();
  return useMutation({
    mutationFn: () => settingsService.deleteAvatar(),
    onSuccess: propagate,
  });
};
