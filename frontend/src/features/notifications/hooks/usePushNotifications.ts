/**
 * @file usePushNotifications.ts
 * @description Web Push (VAPID) lifecycle controller — environment capability detection,
 * permission state machine, subscription registration, and rotation handling.
 * Surfaces a discriminated `availability` so the UI can render distinct states for:
 * unsupported browsers, missing VAPID config, insecure context, and iOS-not-standalone.
 * @architecture Enterprise SaaS 2026
 * @module notifications/hooks/usePushNotifications
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useRegisterPushDevice,
  useUnregisterPushDevice,
  useSendTestPush,
  type PushDevicePayload,
} from "@/features/notifications/api/devices";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushAvailability =
  | { kind: "ready" }
  | { kind: "unsupported"; reason: "browser" }
  | { kind: "unsupported"; reason: "insecure-context" }
  | { kind: "unsupported"; reason: "ios-not-standalone" }
  | { kind: "misconfigured"; reason: "missing-vapid-key" };

export interface UsePushNotificationsReturn {
  availability: PushAvailability;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  isSendingTest: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  sendTest: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function detectAvailability(): PushAvailability {
  if (typeof window === "undefined") return { kind: "unsupported", reason: "browser" };

  const hasApi =
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!hasApi) {
    // iOS Safari only exposes Push API when the page is launched as a PWA from the home screen.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone) {
      return { kind: "unsupported", reason: "ios-not-standalone" };
    }
    return { kind: "unsupported", reason: "browser" };
  }

  if (!window.isSecureContext) {
    return { kind: "unsupported", reason: "insecure-context" };
  }

  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.length < 32) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(
        "[PushNotifications] VITE_VAPID_PUBLIC_KEY is missing or invalid. " +
          "Set it in frontend/.env (and pass it as a build ARG in Docker for production builds).",
      );
    }
    return { kind: "misconfigured", reason: "missing-vapid-key" };
  }

  return { kind: "ready" };
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const availability = useMemo<PushAvailability>(() => detectAvailability(), []);
  const isReady = availability.kind === "ready";

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    isReady ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  const registerMutation = useRegisterPushDevice();
  const unregisterMutation = useUnregisterPushDevice();
  const testMutation = useSendTestPush();

  const isLoading = registerMutation.isPending || unregisterMutation.isPending;

  // Sync existing subscription state on mount.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => {
        if (!cancelled) setIsSubscribed(!!existing);
      })
      .catch(() => {
        /* noop — SW not yet registered, treated as unsubscribed */
      });
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  // Bridge browser-initiated subscription rotation (pushsubscriptionchange in sw.ts) to backend.
  useEffect(() => {
    if (!isReady) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        const payload = event.data.subscription as PushDevicePayload;
        registerMutation.mutate(payload);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [isReady, registerMutation]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (availability.kind !== "ready") {
      if (availability.kind === "misconfigured") {
        toast.error("Powiadomienia są tymczasowo niedostępne. Skontaktuj się z administratorem.");
      }
      return false;
    }
    if (Notification.permission === "denied") {
      toast.error("Powiadomienia są zablokowane w ustawieniach przeglądarki.");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        if (result === "denied") {
          toast.error("Odmówiłeś dostępu. Możesz to zmienić w ustawieniach przeglądarki.");
        }
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        }));

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
      toast.success("Powiadomienia push aktywne na tym urządzeniu.");
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[PushNotifications] Subscription failed:", error);
      toast.error("Nie udało się aktywować powiadomień. Spróbuj ponownie za chwilę.");
      return false;
    }
  }, [availability, registerMutation]);

  const unsubscribe = useCallback(async () => {
    if (!isReady) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await unregisterMutation.mutateAsync(endpoint);
      setIsSubscribed(false);
      toast.success("Powiadomienia push wyłączone.");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[PushNotifications] Unsubscribe failed:", error);
      toast.error("Nie udało się wyłączyć powiadomień push.");
    }
  }, [isReady, unregisterMutation]);

  const sendTest = useCallback(async () => {
    if (!isReady || !isSubscribed) return;
    try {
      await testMutation.mutateAsync();
      toast.success("Test powiadomienia wysłany — sprawdź pasek powiadomień.");
    } catch {
      toast.error("Nie udało się wysłać testu. Spróbuj ponownie.");
    }
  }, [isReady, isSubscribed, testMutation]);

  return {
    availability,
    permission,
    isSubscribed,
    isLoading,
    isSendingTest: testMutation.isPending,
    subscribe,
    unsubscribe,
    sendTest,
  };
};
