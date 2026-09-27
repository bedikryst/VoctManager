/**
 * @file devices.ts
 * @description React Query hooks for Web Push devices: registration, deregistration,
 * one-shot test push dispatch, and the account's active-device count.
 * @architecture Enterprise SaaS 2026
 * @module notifications/api/devices
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/api";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import type { PushDeviceSummaryDTO, WebPushSubscribeDTO } from "../types/notifications.dto";

export const PUSH_DEVICE_SUMMARY_KEY = ["notifications", "push-devices"] as const;

/**
 * Registers (or refreshes) this browser's subscription. The endpoint is an
 * update_or_create keyed on the endpoint URL, so re-posting a subscription the
 * server already knows is a no-op that also lifts it back to active — which is
 * what the boot-time sync relies on.
 */
export const registerPushDevice = async (payload: WebPushSubscribeDTO): Promise<void> => {
  await api.post("/api/notifications/devices/", payload);
};

/**
 * How many of the member's devices can take a push right now. Permission is
 * granted per browser, so this is what lets a device without a subscription
 * know that the member already has push elsewhere — and whether the server is
 * currently standing in for push with e-mail (it does at zero). Shared as
 * options so a one-off read (`queryClient.fetchQuery`) hits the same cache.
 */
export const pushDeviceSummaryQuery = {
  queryKey: PUSH_DEVICE_SUMMARY_KEY,
  queryFn: async (): Promise<PushDeviceSummaryDTO> => {
    const { data } = await api.get<PushDeviceSummaryDTO>("/api/notifications/devices/");
    return data;
  },
  staleTime: 5 * 60 * 1000,
};

export const usePushDeviceSummary = (enabled = true) => {
  return useQuery({ ...pushDeviceSummaryQuery, enabled, ...RECONCILING_REFETCH });
};

export const useRegisterPushDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerPushDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PUSH_DEVICE_SUMMARY_KEY }),
  });
};

export const useUnregisterPushDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (endpoint: string) => {
      await api.delete(`/api/notifications/devices/${encodeURIComponent(endpoint)}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PUSH_DEVICE_SUMMARY_KEY }),
  });
};

export const useSendTestPush = () => {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/notifications/devices/test/");
      return data as { delivered: number };
    },
  });
};
