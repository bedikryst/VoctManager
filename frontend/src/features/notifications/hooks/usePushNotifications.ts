/**
 * @file usePushNotifications.ts
 * @description Manages the full lifecycle of Web Push (VAPID) subscriptions.
 * Handles browser permission, service worker registration, push subscription,
 * and syncing the subscription to the backend via React Query mutations.
 * Also listens for browser-initiated subscription renewals (pushsubscriptionchange).
 * @architecture Enterprise SaaS 2026
 * @module notifications/hooks/usePushNotifications
 */
import { useState, useEffect, useCallback } from "react";
import {
  useRegisterPushDevice,
  useUnregisterPushDevice,
  type PushDevicePayload,
} from "@/features/notifications/api/devices";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const isPushSupported =
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

export interface UsePushNotificationsReturn {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermission>(
    isPushSupported ? Notification.permission : "denied",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  const registerMutation = useRegisterPushDevice();
  const unregisterMutation = useUnregisterPushDevice();

  const isLoading = registerMutation.isPending || unregisterMutation.isPending;

  useEffect(() => {
    if (!isPushSupported) return;
    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setIsSubscribed(!!existing);
    });
  }, []);

  // Handles browser-initiated subscription rotation (pushsubscriptionchange in sw.ts).
  // The SW posts the new subscription here so we can sync it with the backend while authenticated.
  useEffect(() => {
    if (!isPushSupported) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        const payload = event.data.subscription as PushDevicePayload;
        registerMutation.mutate(payload);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [registerMutation]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || permission === "denied") return;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await registerMutation.mutateAsync({
        endpoint: json.endpoint,
        p256dh_key: json.keys.p256dh,
        auth_key: json.keys.auth,
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error("[PushNotifications] Subscription failed:", error);
    }
  }, [permission, registerMutation]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unregisterMutation.mutateAsync(endpoint);
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error("[PushNotifications] Unsubscribe failed:", error);
    }
  }, [unregisterMutation]);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
};
