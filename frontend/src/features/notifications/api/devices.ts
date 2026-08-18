/**
 * @file devices.ts
 * @description React Query mutations for Web Push device registration, deregistration,
 * and one-shot test push dispatch.
 * @architecture Enterprise SaaS 2026
 * @module notifications/api/devices
 */
import { useMutation } from "@tanstack/react-query";
import api from "@/shared/api/api";
import type { WebPushSubscribeDTO } from "../types/notifications.dto";

/**
 * Registers (or refreshes) this browser's subscription. The endpoint is an
 * update_or_create keyed on the endpoint URL, so re-posting a subscription the
 * server already knows is a no-op that also lifts it back to active — which is
 * what the boot-time sync relies on.
 */
export const registerPushDevice = async (payload: WebPushSubscribeDTO): Promise<void> => {
  await api.post("/api/notifications/devices/", payload);
};

export const useRegisterPushDevice = () => {
  return useMutation({ mutationFn: registerPushDevice });
};

export const useUnregisterPushDevice = () => {
  return useMutation({
    mutationFn: async (endpoint: string) => {
      await api.delete(`/api/notifications/devices/${encodeURIComponent(endpoint)}/`);
    },
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
