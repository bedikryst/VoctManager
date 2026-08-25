/**
 * @file swProtocol.ts
 * @description Shared contract between the app thread and the service worker.
 * Imported by BOTH `src/sw.ts` (worker) and the app, so cache names and the
 * message shapes can never drift apart. Keep this file dependency-free — it is
 * pulled into the worker bundle, which must stay lean.
 * @module shared/offline/swProtocol
 */

/** Full audio bodies, range-served to the <audio> element while offline. */
export const AUDIO_CACHE = "voct-practice-audio-v1";
/** Gated score-edition PDFs (same URL the in-app viewer fetches). */
export const SCORE_CACHE = "voct-scores-v1";
/** NetworkFirst snapshot of the personal dashboard reads. */
export const API_CACHE = "voct-api-v1";

/** Every offline-managed cache, so a full wipe (logout) can clear them all. */
export const OFFLINE_CACHES = [AUDIO_CACHE, SCORE_CACHE, API_CACHE] as const;

/** Which managed cache an explicit-download asset belongs in. */
export type OfflineAssetKind = "audio" | "score";

export interface OfflineAsset {
  url: string;
  kind: OfflineAssetKind;
}

// ── app → worker ────────────────────────────────────────────────────────────

export interface CacheAssetsRequest {
  type: "VOCT_CACHE_ASSETS";
  assets: OfflineAsset[];
}

export interface EvictAssetsRequest {
  type: "VOCT_EVICT_ASSETS";
  urls: string[];
}

export interface ClearOfflineRequest {
  type: "VOCT_CLEAR_OFFLINE";
}

/**
 * Release a worker parked in `waiting`. The worker does NOT call `skipWaiting()`
 * on install any more: a new build that seizes an open tab swaps the precache
 * under a bundle already running, and the old chunks it still needs are then
 * gone from both the cache and the server. So the app thread owns the moment of
 * the handover — it sends this immediately before reloading onto the new build.
 */
export interface SkipWaitingRequest {
  type: "VOCT_SKIP_WAITING";
}

export type OfflineSwRequest =
  | CacheAssetsRequest
  | EvictAssetsRequest
  | ClearOfflineRequest
  | SkipWaitingRequest;

// ── worker → app (over the request's MessageChannel port) ───────────────────

export interface CacheProgressMessage {
  type: "VOCT_CACHE_PROGRESS";
  done: number;
  total: number;
  failed: number;
}

export interface CacheDoneMessage {
  type: "VOCT_CACHE_DONE";
  cached: number;
  failed: number;
}

export type OfflineSwReply = CacheProgressMessage | CacheDoneMessage;

// ── worker → app (broadcast to every open window) ───────────────────────────

/**
 * A push arrived. The worker sees server-side change before any polled query
 * does, so it tells the open app to reconcile instead of leaving the reader with
 * a notification about content the panel still cannot show.
 */
export interface PushReceivedBroadcast {
  type: "VOCT_PUSH_RECEIVED";
  /** `NotificationType` from the push payload, e.g. "MESSAGE_RECEIVED". */
  notificationType: string;
}

export type SwBroadcast = PushReceivedBroadcast;

export const cacheNameForKind = (kind: OfflineAssetKind): string =>
  kind === "audio" ? AUDIO_CACHE : SCORE_CACHE;
