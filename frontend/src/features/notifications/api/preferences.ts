// src/features/notifications/api/preferences.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/api";
import type {
  NotificationPreferenceDTO,
  NotificationPreferenceUpdateDTO,
} from "../types/notifications.dto";
import { recommendedChannels, restorePayload } from "../lib/preferences";

export const preferenceKeys = {
  all: ["notification-preferences"] as const,
};

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: async (): Promise<NotificationPreferenceDTO[]> => {
      const { data } = await api.get("/api/notifications/preferences/");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdatePreference = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updated: NotificationPreferenceUpdateDTO,
    ) => {
      const { data } = await api.patch(
        `/api/notifications/preferences/${updated.notification_type}/`,
        updated,
      );
      return data;
    },
    onMutate: async (newPref) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all });
      const previous = queryClient.getQueryData<NotificationPreferenceDTO[]>(
        preferenceKeys.all,
      );

      if (previous) {
        queryClient.setQueryData<NotificationPreferenceDTO[]>(
          preferenceKeys.all,
          previous.map((p) =>
            p.notification_type === newPref.notification_type
              ? { ...p, ...newPref }
              : p,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _new, context) => {
      if (context?.previous) {
        queryClient.setQueryData(preferenceKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferenceKeys.all });
    },
  });
};

/**
 * Restores a set of rows (typically one domain group) to the shared recommended
 * baseline. Only the rows that actually diverge are PATCHed; the cache is patched
 * once optimistically and invalidated once, so a section reset is a single visual
 * step regardless of how many rows it touches.
 */
export const useRestoreRecommendedPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rows,
      includePush,
    }: {
      rows: NotificationPreferenceDTO[];
      includePush: boolean;
    }) => {
      const preferences = restorePayload(rows, includePush);
      if (preferences.length === 0) return;
      await api.put("/api/notifications/preferences/", { preferences });
    },
    onMutate: async ({ rows, includePush }) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all });
      const previous = queryClient.getQueryData<NotificationPreferenceDTO[]>(
        preferenceKeys.all,
      );
      const targeted = new Set(rows.map((p) => p.notification_type));
      if (previous) {
        queryClient.setQueryData<NotificationPreferenceDTO[]>(
          preferenceKeys.all,
          previous.map((p) => {
            if (!targeted.has(p.notification_type)) return p;
            const recommended = recommendedChannels(p);
            return {
              ...p,
              email_enabled: recommended.email_enabled,
              push_enabled: includePush ? recommended.push_enabled : p.push_enabled,
            };
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _rows, context) => {
      if (context?.previous) {
        queryClient.setQueryData(preferenceKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferenceKeys.all });
    },
  });
};
