/**
 * @file sw.ts
 * @description VoctManager Service Worker — compiled by vite-plugin-pwa (injectManifest strategy).
 *
 * Two responsibilities:
 *  1. Web Push — renders structured payloads (title, body, level, deep-link URL,
 *     quick-actions), routes notification clicks, recovers from VAPID rotation.
 *  2. Real offline — precaches the app shell so the PWA *boots* without network,
 *     runtime-caches practice audio (range-served), score PDFs and the personal
 *     dashboard reads, and exposes a message channel the app uses to explicitly
 *     download a whole concert's materials for the train/metro.
 *
 * Runs outside the main thread; no DOM access.
 * @architecture Enterprise SaaS 2026
 * @module notifications/infrastructure/sw
 */
/// <reference lib="webworker" />
/// <reference types="vite/client" />

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { RangeRequestsPlugin } from "workbox-range-requests";

import {
  AUDIO_CACHE,
  SCORE_CACHE,
  API_CACHE,
  OFFLINE_CACHES,
  cacheNameForKind,
  type OfflineAsset,
  type OfflineSwRequest,
  type OfflineSwReply,
} from "@/shared/offline/swProtocol";

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

// ── precache + offline routing ───────────────────────────────────────────────

// Shell (JS/CSS/HTML/fonts/icons) injected by vite-plugin-pwa from the build.
// With this populated, the PWA boots offline instead of hitting the dino page.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const isSameOrigin = (url: URL): boolean => url.origin === self.location.origin;

const THIRTY_DAYS_S = 60 * 60 * 24 * 30;

// Practice audio (raw /media/audio_tracks/…). CacheFirst + RangeRequests so the
// <audio> element's `Range:` requests are sliced out of the FULL body that the
// explicit "download for offline" flow stored — passive streaming yields 206s
// that never populate a cache, which is exactly why offline practice needs the
// explicit download. Network 206s are filtered (statuses: [200]) on purpose.
registerRoute(
  ({ url }) => isSameOrigin(url) && url.pathname.includes("/media/audio"),
  new CacheFirst({
    cacheName: AUDIO_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new RangeRequestsPlugin(),
      new ExpirationPlugin({
        maxEntries: 240,
        maxAgeSeconds: THIRTY_DAYS_S,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Gated score-edition PDFs — the same URL the in-app viewer fetches, so a
// passively-viewed score is offline too, and an explicitly-downloaded one is
// served to the viewer's axios request straight from cache.
registerRoute(
  ({ url }) =>
    isSameOrigin(url) &&
    url.pathname.startsWith("/api/materials/scores/") &&
    url.pathname.endsWith("/download/"),
  new CacheFirst({
    cacheName: SCORE_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: THIRTY_DAYS_S,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Personal dashboard reads — NetworkFirst so fresh data wins online but the last
// good snapshot answers offline. (React Query already persists the JSON; this is
// belt-and-suspenders that also survives a localStorage wipe.)
const OFFLINE_API_READS = new Set([
  "/api/participations/schedule-dashboard/",
  "/api/participations/materials-dashboard/",
]);
registerRoute(
  ({ url, request }) =>
    isSameOrigin(url) &&
    request.method === "GET" &&
    OFFLINE_API_READS.has(url.pathname),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: THIRTY_DAYS_S }),
    ],
  }),
);

// Boot offline: serve the precached shell for any navigation the browser can't
// fulfil from the network. Production-only — in dev the shell isn't precached
// and this would shadow Vite's index. API/media/admin are denied so they 404
// honestly instead of returning the SPA document.
if (import.meta.env.PROD) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL("index.html"), {
      denylist: [/^\/api\//, /^\/media\//, /^\/admin\//, /^\/django-static\//],
    }),
  );
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// ── explicit offline download (app-driven) ───────────────────────────────────

self.addEventListener("message", (event) => {
  const data = event.data as OfflineSwRequest | undefined;
  if (!data || typeof data.type !== "string") return;

  const port = event.ports[0] ?? null;

  if (data.type === "VOCT_CACHE_ASSETS") {
    event.waitUntil(cacheAssets(data.assets, port));
  } else if (data.type === "VOCT_EVICT_ASSETS") {
    event.waitUntil(evictAssets(data.urls));
  } else if (data.type === "VOCT_CLEAR_OFFLINE") {
    event.waitUntil(Promise.all(OFFLINE_CACHES.map((name) => caches.delete(name))));
  }
});

/**
 * Fetches each asset as a FULL body and stores it under its managed cache,
 * reporting progress over the request's MessageChannel port. Per-asset failures
 * are tolerated (one missing track must not abort the rest of the concert).
 */
async function cacheAssets(
  assets: OfflineAsset[],
  port: MessagePort | null,
): Promise<void> {
  const total = assets.length;
  let done = 0;
  let failed = 0;

  const reply = (message: OfflineSwReply): void => port?.postMessage(message);

  for (const asset of assets) {
    try {
      const cache = await caches.open(cacheNameForKind(asset.kind));
      const existing = await cache.match(asset.url);
      if (!existing) {
        // Plain GET (no Range) → full 200 the RangeRequestsPlugin can slice later.
        const response = await fetch(asset.url, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(asset.url, response.clone());
      }
    } catch {
      failed += 1;
    } finally {
      done += 1;
      reply({ type: "VOCT_CACHE_PROGRESS", done, total, failed });
    }
  }

  reply({ type: "VOCT_CACHE_DONE", cached: done - failed, failed });
}

async function evictAssets(urls: string[]): Promise<void> {
  await Promise.all(
    OFFLINE_CACHES.map(async (name) => {
      const cache = await caches.open(name);
      await Promise.all(urls.map((url) => cache.delete(url)));
    }),
  );
}

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
