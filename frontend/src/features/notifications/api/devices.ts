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

export const useRegisterPushDevice = () => {
  return useMutation({
    mutationFn: async (payload: WebPushSubscribeDTO) => {
      const { data } = await api.post("/api/notifications/devices/", payload);
      return data;
    },
  });
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
