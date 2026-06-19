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

export type OfflineSwRequest =
  | CacheAssetsRequest
  | EvictAssetsRequest
  | ClearOfflineRequest;

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

export const cacheNameForKind = (kind: OfflineAssetKind): string =>
  kind === "audio" ? AUDIO_CACHE : SCORE_CACHE;
