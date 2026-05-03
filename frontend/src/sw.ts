/**
 * @file sw.ts
 * @description VoctManager Service Worker — compiled by vite-plugin-pwa (injectManifest strategy).
 * Renders structured Web Push payloads (title, body, level, deep-link URL, quick-actions),
 * routes notification clicks to the in-app destination, and recovers from VAPID subscription
 * rotation. Runs outside the main thread; no DOM access.
 * @architecture Enterprise SaaS 2026
 * @module notifications/infrastructure/sw
 */
/// <reference lib="webworker" />
/// <reference types="vite/client" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

interface ServiceWorkerNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  actions?: ReadonlyArray<{ action: string; title: string; icon?: string }>;
  vibrate?: ReadonlyArray<number>;
}

interface PushAction {
  action: string;
  title: string;
}

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  type?: string;
  level?: "INFO" | "WARNING" | "URGENT";
  renotify?: boolean;
  actions?: PushAction[];
}

const FALLBACK_URL = "/panel";
const DEFAULT_TAG = "voct-push";
const ICON = "/logo.png";
const BADGE = "/logo.png";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  const title = payload.title?.trim() || "VoctManager";
  const isUrgent = payload.level === "URGENT";
  const isWarning = payload.level === "WARNING";

  const options: ServiceWorkerNotificationOptions = {
    body: payload.body ?? "",
    icon: ICON,
    badge: BADGE,
    tag: payload.tag ?? DEFAULT_TAG,
    renotify: payload.renotify ?? true,
    requireInteraction: isUrgent,
    silent: false,
    vibrate: isUrgent ? [200, 100, 200, 100, 200] : isWarning ? [120, 80, 120] : [80],
    actions: (payload.actions ?? []).slice(0, 2).map((a) => ({
      action: a.action,
      title: a.title,
    })),
    data: {
      url: payload.url ?? FALLBACK_URL,
      type: payload.type ?? "GENERIC",
      level: payload.level ?? "INFO",
      tag: payload.tag ?? DEFAULT_TAG,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const data = event.notification.data as { url?: string } | undefined;
  const targetUrl = data?.url && data.url.length > 0 ? data.url : FALLBACK_URL;

  event.waitUntil(focusOrOpen(targetUrl));
});

self.addEventListener("pushsubscriptionchange", (rawEvent) => {
  const event = rawEvent as ExtendableEvent;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) {
    console.error("[SW] VITE_VAPID_PUBLIC_KEY missing — cannot resubscribe after rotation.");
    return;
  }

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      .then((newSub) => {
        const json = newSub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };
        return self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) =>
              client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: json }),
            );
          });
      }),
  );
});

function parsePayload(event: PushEvent): PushPayload {
  if (!event.data) return {};
  try {
    return event.data.json() as PushPayload;
  } catch {
    return { title: "VoctManager", body: event.data.text() };
  }
}

async function focusOrOpen(targetUrl: string): Promise<void> {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of clients) {
    if (client.url.startsWith(self.location.origin)) {
      try {
        await (client as WindowClient).navigate(targetUrl);
      } catch {
        // navigate() throws if the client is cross-origin or detached.
      }
      return (client as WindowClient).focus().then(() => undefined);
    }
  }

  await self.clients.openWindow(targetUrl);
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return buffer;
}
