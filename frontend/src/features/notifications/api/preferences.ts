// src/features/notifications/api/preferences.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/api";
import type {
  NotificationPreferenceDTO,
  NotificationPreferenceUpdateDTO,
} from "../types/notifications.dto";

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
