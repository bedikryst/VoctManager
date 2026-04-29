/**
 * @file sw.ts
 * @description VoctManager Service Worker — compiled by vite-plugin-pwa (injectManifest strategy).
 * Handles Web Push delivery, notification click navigation, and VAPID subscription renewal.
 * Runs outside the main browser thread; no access to DOM or React state.
 * @architecture Enterprise SaaS 2026
 * @module notifications/infrastructure/sw
 */
/// <reference lib="webworker" />
/// <reference types="vite/client" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa at build time. globPatterns:[] means an empty array — no precaching.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data: Record<string, unknown> = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "VoctManager", body: event.data?.text() ?? "" };
  }

  const title = (data.title as string) ?? "VoctManager";
  const options: NotificationOptions = {
    body: (data.body as string) ?? "",
    icon: "/monogram_V.png",
    badge: "/monogram_V.png",
    tag: (data.tag as string) ?? "voct-push",
    renotify: Boolean(data.renotify),
    data: { url: (data.url as string) ?? "/panel" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string | undefined) ?? "/panel";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            (client as WindowClient).navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

// Fires when the push service rotates the subscription (e.g., key expiry, browser security update).
// Re-subscribes and notifies open app windows so they can sync the new endpoint with the backend.
// Without this, subscriptions silently break after rotation and users stop receiving push notifications.
self.addEventListener("pushsubscriptionchange", (rawEvent) => {
  const event = rawEvent as ExtendableEvent;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
