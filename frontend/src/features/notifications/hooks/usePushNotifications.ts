/**
 * @file usePushNotifications.ts
 * @description Web Push (VAPID) lifecycle controller — environment capability detection,
 * permission state machine, subscription registration, and rotation handling.
 * Surfaces a discriminated `availability` so the UI can render distinct states for:
 * unsupported browsers, missing VAPID config, insecure context, and iOS-not-standalone.
 * @architecture Enterprise SaaS 2026
 * @module notifications/hooks/usePushNotifications
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import i18n from "@/shared/config/i18n";
import {
  useRegisterPushDevice,
  useUnregisterPushDevice,
  useSendTestPush,
} from "@/features/notifications/api/devices";
import { isAppleTouchDevice, isStandaloneDisplay } from "@/shared/pwa/platform";
import {
  forgetPushDeviceSync,
  markPushDeviceSynced,
  syncPushDevice,
  toSubscribeDTO,
} from "../lib/pushDeviceSync";
import type { WebPushSubscribeDTO } from "../types/notifications.dto";

/** Localized toast text. The hook isn't a component, so it reads the shared
 * i18n instance directly (resources are loaded at app init). */
const tt = (key: string): string => i18n.t(`notifications.push.toasts.${key}`);

/**
 * The diagnostic endpoint names *why* nothing arrived, and the two reasons ask
 * different things of the member: a device the server no longer holds is fixed
 * from this very tab, while a push service that refused the send is fixed by
 * nobody here. A response without a reason (a network drop, an old server)
 * falls back to the generic failure.
 */
const testFailureKey = (error: unknown): string => {
  const reason = isAxiosError(error)
    ? (error.response?.data as { reason?: string } | undefined)?.reason
    : undefined;
  if (reason === "no_devices") return "test_no_device";
  if (reason === "undeliverable") return "test_undeliverable";
  return "test_failed";
};

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
  /**
   * Fires the diagnostic push and reports how many devices it **actually
   * reached** — the server counts successful sends, not attempts, so a
   * subscription the browser has already discarded comes back as 0. Callers may
   * treat a positive number as proof the whole chain works for this member.
   */
  sendTest: () => Promise<number>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
}

function detectAvailability(): PushAvailability {
  if (typeof window === "undefined") return { kind: "unsupported", reason: "browser" };

  const hasApi =
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!hasApi) {
    // iOS Safari only exposes Push API when the page is launched as a PWA from
    // the home screen — which is a fixable state, unlike a browser that simply
    // cannot do push, so the device must be recognised (iPadOS included) or the
    // member gets a dead end instead of the install instruction.
    if (isAppleTouchDevice() && !isStandaloneDisplay()) {
      return { kind: "unsupported", reason: "ios-not-standalone" };
    }
    return { kind: "unsupported", reason: "browser" };
  }

  if (!window.isSecureContext) {
    return { kind: "unsupported", reason: "insecure-context" };
  }

  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.length < 32) {
    if (import.meta.env.DEV) {
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

  // The mutation object's identity changes with its own state, so effects that
  // must not re-run on every dispatch reach the trigger through this ref.
  const registerDeviceRef = useRef(registerMutation.mutate);
  useEffect(() => {
    registerDeviceRef.current = registerMutation.mutate;
  });

  // Read the browser's subscription on mount — and re-assert it server-side, so
  // a device row the server dropped or deactivated is repaired rather than left
  // showing as ON here. Deduplicated per session, so opening this tab after the
  // shell has already synced costs nothing.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    void syncPushDevice().then((existing) => {
      if (!cancelled) setIsSubscribed(!!existing);
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
        const payload = event.data.subscription as WebPushSubscribeDTO;
        markPushDeviceSynced(payload.endpoint);
        registerDeviceRef.current(payload);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [isReady]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (availability.kind !== "ready") {
      if (availability.kind === "misconfigured") {
        toast.error(tt("unavailable"));
      }
      return false;
    }
    if (Notification.permission === "denied") {
      toast.error(tt("denied_blocked"));
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        if (result === "denied") {
          toast.error(tt("denied_now"));
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

      const payload = toSubscribeDTO(subscription);
      if (!payload) {
        toast.error(tt("subscribe_failed"));
        return false;
      }

      await registerMutation.mutateAsync(payload);
      markPushDeviceSynced(payload.endpoint);

      setIsSubscribed(true);
      toast.success(tt("enabled"));
      return true;
    } catch (error) {
      console.error("[PushNotifications] Subscription failed:", error);
      toast.error(tt("subscribe_failed"));
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
      forgetPushDeviceSync(endpoint);
      setIsSubscribed(false);
      toast.success(tt("disabled"));
    } catch (error) {
      console.error("[PushNotifications] Unsubscribe failed:", error);
      toast.error(tt("unsubscribe_failed"));
    }
  }, [isReady, unregisterMutation]);

  const sendTest = useCallback(async (): Promise<number> => {
    if (!isReady || !isSubscribed) return 0;
    try {
      const { delivered } = await testMutation.mutateAsync();
      toast.success(tt("test_sent"));
      return delivered;
    } catch (error) {
      toast.error(tt(testFailureKey(error)));
      return 0;
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
