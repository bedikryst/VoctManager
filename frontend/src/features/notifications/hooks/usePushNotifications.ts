/**
 * @file usePushNotifications.ts
 * @description Manages the full lifecycle of Web Push (VAPID) subscriptions.
 * Handles browser permission, service worker registration, push subscription,
 * and syncing the subscription to the backend.
 * @architecture Enterprise SaaS 2026
 * @module notifications/hooks/usePushNotifications
 */
import { useState, useEffect, useCallback } from "react";
import api from "@/shared/api/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY as string;

/** Converts the base64url VAPID public key to the Uint8Array the browser Push API expects. */
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
  /** Current browser notification permission state. */
  permission: NotificationPermission;
  /** Whether this browser has an active push subscription registered on the server. */
  isSubscribed: boolean;
  /** True while requesting permission or syncing with the server. */
  isLoading: boolean;
  /** Request permission and subscribe. No-op if already granted. */
  subscribe: () => Promise<void>;
  /** Unsubscribe and remove the subscription from the server. */
  unsubscribe: () => Promise<void>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermission>(
    isPushSupported ? Notification.permission : "denied",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // On mount, check whether this browser already has an active subscription.
  useEffect(() => {
    if (!isPushSupported) return;

    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setIsSubscribed(!!existing);
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || permission === "denied") return;

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      // Register SW if not already active.
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await api.post("/api/notifications/devices/", {
        endpoint: json.endpoint,
        p256dh_key: json.keys.p256dh,
        auth_key: json.keys.auth,
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error("[PushNotifications] Subscription failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [permission]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        // The endpoint URL is the pk used by the backend destroy endpoint.
        await api.delete(
          `/api/notifications/devices/${encodeURIComponent(endpoint)}/`,
        );
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error("[PushNotifications] Unsubscribe failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
};
