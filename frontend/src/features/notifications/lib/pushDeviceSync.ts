/**
 * @file pushDeviceSync.ts
 * @description Re-asserts this browser's Web Push subscription on the server.
 * The browser is the only authority on whether a device is subscribed, but the
 * server row it maps to can disappear underneath it — deactivated after a
 * transient rejection from the push service, or pruned. Nothing in the browser
 * is told when that happens: `pushManager.getSubscription()` keeps returning a
 * healthy-looking subscription while every dispatch reaches nobody, and the
 * settings tab keeps showing push as ON. Posting the subscription once per
 * session repairs the row (the endpoint is an update_or_create) instead of
 * waiting for the member to guess that toggling push off and on again is the
 * cure. The same pass moves a subscription still bound to the app's old worker
 * at "/" onto the one at `/panel`.
 * @module notifications/lib/pushDeviceSync
 */
import {
  getActiveServiceWorkerRegistration,
  getRootServiceWorkerRegistration,
  retireRootServiceWorker,
} from "@/shared/offline/offlineClient";

import { registerPushDevice, unregisterPushDevice } from "../api/devices";
import type { WebPushSubscribeDTO } from "../types/notifications.dto";

/**
 * Endpoints already re-asserted in this page session. The repair is worth one
 * request per session, not one per mount — the settings tab and the panel shell
 * both ask for it, and a subscription that has just been registered needs no
 * second POST.
 */
const syncedEndpoints = new Set<string>();

/** Records an endpoint the caller has just registered itself. */
export const markPushDeviceSynced = (endpoint: string): void => {
  syncedEndpoints.add(endpoint);
};

/** Drops an endpoint from the session ledger, so a later re-subscribe re-posts it. */
export const forgetPushDeviceSync = (endpoint: string): void => {
  syncedEndpoints.delete(endpoint);
};

/**
 * The subscription in the shape the API expects, or null when the browser
 * handed back a subscription without its encryption keys (nothing can be sent
 * to it, so registering it would only mint a device that fails every dispatch).
 */
export const toSubscribeDTO = (subscription: PushSubscription): WebPushSubscribeDTO | null => {
  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return {
    endpoint: json.endpoint,
    p256dh_key: json.keys.p256dh,
    auth_key: json.keys.auth,
  };
};

/**
 * Moves a subscription made on the worker the app once registered at "/" onto
 * `registration`, then retires the old worker. Chrome on Android shows a push
 * from the "/" worker as Chrome's own — its icon in the tray, no count on the
 * app's launcher icon — because the installed app's scope is `/panel`.
 *
 * The new subscription reaches the server before the old one is let go, so a
 * failure at any step leaves the member reachable, at worst twice over until
 * the next session finishes the move. Resolves to the moved subscription, or
 * null when there was nothing to move or the move failed.
 */
const handOverRootSubscription = async (
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> => {
  const root = await getRootServiceWorkerRegistration();
  const legacy = root ? await root.pushManager.getSubscription() : null;
  if (!root || !legacy) return null;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: legacy.options.applicationServerKey,
    }));
  const payload = toSubscribeDTO(subscription);
  if (!payload) return null;

  await registerPushDevice(payload);
  syncedEndpoints.add(payload.endpoint);
  // Best effort: once unsubscribed, the old endpoint is refused by the push
  // service and the server deactivates the row on its next send.
  await unregisterPushDevice(legacy.endpoint).catch(() => undefined);
  await legacy.unsubscribe();
  await retireRootServiceWorker(root);
  return subscription;
};

/** One move per page session; the shell and the settings tab both sync. */
let handover: Promise<PushSubscription | null> | null = null;

/**
 * Reads this browser's subscription and, the first time it is seen in a session,
 * re-registers it. Returns the subscription so callers can derive their own
 * "is this device subscribed" state from the same read. Never throws: an absent
 * service worker or a failed POST leaves push exactly as it was.
 */
export const syncPushDevice = async (): Promise<PushSubscription | null> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  let subscription: PushSubscription | null = null;
  try {
    const registration = await getActiveServiceWorkerRegistration();
    if (!registration) return null;
    handover ??= handOverRootSubscription(registration).catch(() => null);
    subscription = (await handover) ?? (await registration.pushManager.getSubscription());
  } catch {
    return null;
  }
  if (!subscription || syncedEndpoints.has(subscription.endpoint)) return subscription;

  const payload = toSubscribeDTO(subscription);
  if (!payload) return subscription;

  try {
    await registerPushDevice(payload);
    syncedEndpoints.add(payload.endpoint);
  } catch {
    /* The row stays as it was; the next session tries again. */
  }
  return subscription;
};
