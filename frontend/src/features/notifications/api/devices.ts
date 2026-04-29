/**
 * @file devices.ts
 * @description React Query mutations for Web Push device registration and deregistration.
 * @architecture Enterprise SaaS 2026
 * @module notifications/api/devices
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/shared/api/api";

export interface PushDevicePayload {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

export const useRegisterPushDevice = () => {
  return useMutation({
    mutationFn: async (payload: PushDevicePayload) => {
      const { data } = await api.post("/api/notifications/devices/", payload);
      return data;
    },
    onError: () => {
      toast.error("Nie udało się aktywować powiadomień push.");
    },
  });
};

export const useUnregisterPushDevice = () => {
  return useMutation({
    mutationFn: async (endpoint: string) => {
      await api.delete(`/api/notifications/devices/${encodeURIComponent(endpoint)}/`);
    },
    onError: () => {
      toast.error("Nie udało się wyłączyć powiadomień push.");
    },
  });
};
