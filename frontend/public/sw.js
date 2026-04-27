/**
 * @file sw.js
 * @description VoctManager Service Worker — handles background Web Push events.
 * Runs outside the main browser thread; no access to DOM or React state.
 * @architecture Enterprise SaaS 2026
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'VoctManager', body: event.data?.text() ?? '' };
  }

  const title = data.title ?? 'VoctManager';
  const options = {
    body: data.body ?? '',
    icon: '/monogram_V.png',
    badge: '/monogram_V.png',
    tag: data.tag ?? 'voct-push',
    renotify: Boolean(data.renotify),
    data: { url: data.url ?? '/panel' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/panel';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
