/**
 * @file preferences.ts
 * @description Server state for the notification settings ledger: the grouped
 * matrix read, and the three writes over it — one type, one whole group's
 * channel, and Restore-recommended for a section. Every write is optimistic and
 * patches the same flat `preferences` list inside the envelope, so the ledger
 * never flickers through a refetch.
 * @architecture Enterprise SaaS 2026
 * @module notifications/api/preferences
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/api";
import type {
  NotificationPreferenceDTO,
  NotificationPreferenceMatrixDTO,
  NotificationPreferenceUpdateDTO,
} from "../types/notifications.dto";
import {
  groupChannelPayload,
  recommendedChannels,
  restorePayload,
  type PreferenceChannel,
  type PreferenceRestoreItem,
} from "../lib/preferences";

const ENDPOINT = "/api/notifications/preferences/";

export const preferenceKeys = {
  // The `matrix` segment is a deliberate cache break: the response was a bare
  // array before the ledger grew groups, and a persisted snapshot of that shape
  // would rehydrate straight into code that now reads an envelope.
  all: ["notification-preferences", "matrix"] as const,
};

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: async (): Promise<NotificationPreferenceMatrixDTO> => {
      const { data } = await api.get<NotificationPreferenceMatrixDTO>(ENDPOINT);
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Applies a row patch to the cached matrix without disturbing the groups beside
 * it. Every mutation below goes through this, so "optimistic" means one shape of
 * edit rather than three.
 */
const patchCachedRows = (
  matrix: NotificationPreferenceMatrixDTO,
  patch: (pref: NotificationPreferenceDTO) => NotificationPreferenceDTO,
): NotificationPreferenceMatrixDTO => ({
  ...matrix,
  preferences: matrix.preferences.map(patch),
});

const applyItems = (
  matrix: NotificationPreferenceMatrixDTO,
  items: readonly PreferenceRestoreItem[],
): NotificationPreferenceMatrixDTO => {
  const byType = new Map(items.map((item) => [item.notification_type, item]));
  return patchCachedRows(matrix, (pref) => {
    const item = byType.get(pref.notification_type);
    return item
      ? { ...pref, email_enabled: item.email_enabled, push_enabled: item.push_enabled }
      : pref;
  });
};

export const useUpdatePreference = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updated: NotificationPreferenceUpdateDTO) => {
      const { data } = await api.patch(
        `${ENDPOINT}${updated.notification_type}/`,
        updated,
      );
      return data;
    },
    onMutate: async (newPref) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all });
      const previous = queryClient.getQueryData<NotificationPreferenceMatrixDTO>(
        preferenceKeys.all,
      );

      if (previous) {
        queryClient.setQueryData<NotificationPreferenceMatrixDTO>(
          preferenceKeys.all,
          patchCachedRows(previous, (pref) =>
            pref.notification_type === newPref.notification_type
              ? { ...pref, ...newPref }
              : pref,
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
 * Puts one channel of a whole group at a single value. The group is the control
 * a reader actually operates, so this is one request and one visual step no
 * matter how many types sit behind it — and only the diverging rows are written,
 * leaving the other channel exactly as they had it.
 */
export const useUpdateGroupChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rows,
      channel,
      value,
    }: {
      rows: readonly NotificationPreferenceDTO[];
      channel: PreferenceChannel;
      value: boolean;
    }) => {
      const preferences = groupChannelPayload(rows, channel, value);
      if (preferences.length === 0) return;
      await api.put(ENDPOINT, { preferences });
    },
    onMutate: async ({ rows, channel, value }) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all });
      const previous = queryClient.getQueryData<NotificationPreferenceMatrixDTO>(
        preferenceKeys.all,
      );
      if (previous) {
        queryClient.setQueryData<NotificationPreferenceMatrixDTO>(
          preferenceKeys.all,
          applyItems(previous, groupChannelPayload(rows, channel, value)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
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
 * Restores a set of rows (typically one group) to the shared recommended
 * baseline. Only the rows that actually diverge are written; the cache is patched
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
      await api.put(ENDPOINT, { preferences });
    },
    onMutate: async ({ rows, includePush }) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all });
      const previous = queryClient.getQueryData<NotificationPreferenceMatrixDTO>(
        preferenceKeys.all,
      );
      const targeted = new Set(rows.map((p) => p.notification_type));
      if (previous) {
        queryClient.setQueryData<NotificationPreferenceMatrixDTO>(
          preferenceKeys.all,
          patchCachedRows(previous, (pref) => {
            if (!targeted.has(pref.notification_type)) return pref;
            const recommended = recommendedChannels(pref);
            return {
              ...pref,
              email_enabled: recommended.email_enabled,
              push_enabled: includePush ? recommended.push_enabled : pref.push_enabled,
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
