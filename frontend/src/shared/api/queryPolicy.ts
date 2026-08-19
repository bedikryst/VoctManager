/**
 * @file queryPolicy.ts
 * @description Single source of truth for cache-freshness policy and the
 * cross-feature "personal read-model" keys.
 *
 * The panel persists its entire query cache to localStorage for 24h
 * (see `queryPersistence.ts`) so choristers get an instant, spinner-free paint
 * on the way to rehearsal — train, church basement, no signal. The catch: a
 * restored snapshot keeps its original `dataUpdatedAt`, so with a positive
 * `staleTime` the cache still considers it "fresh" after a reload and never
 * reconciles. That is why a server-side change (an AI-created composer, a new
 * divisi assignment) used to surface only after the persisted cache aged out or
 * a logout wiped it.
 *
 * Resolution — stale-while-revalidate. Offline-first paint and freshness are
 * NOT in conflict: keep persisting (instant paint from the snapshot) AND, for
 * any data that can change server-side, always kick a background refetch on
 * mount plus on window-focus / reconnect. The snapshot is shown immediately and
 * silently replaced when the network answers. Static dictionaries opt out — a
 * 24h cache is the whole point there, and their writers invalidate explicitly.
 *
 * @architecture Enterprise SaaS 2026
 * @module shared/api/queryPolicy
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Freshness tier for any read-model that can change server-side (including by
 * another user). Spread into the query options; each query keeps its own tuned
 * `staleTime` (which still governs focus-refetch frequency), while
 * `refetchOnMount: "always"` guarantees a reload reconciles from the persisted
 * snapshot regardless of how fresh the cache believes it to be.
 *
 * Do NOT spread this into binary/blob queries (e.g. the PDF viewer) — those set
 * `staleTime: Infinity` deliberately, and `refetchOnMount: "always"` would
 * re-download the blob on every mount.
 */
export const RECONCILING_REFETCH = {
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

/**
 * Freshness tier for a closed vocabulary the server renders in the reader's
 * language — the liturgical slots, and anything else whose only variable is the
 * language it is asked in. It cannot change under a running session, so it is
 * fetched once and never revalidated.
 *
 * The contract that makes `staleTime: Infinity` safe here: the query key MUST
 * carry the language. Without it a reader who switches locale keeps the first
 * language's labels for the life of the persisted cache — which is exactly the
 * failure the server-side vocabulary exists to prevent.
 */
export const SESSION_STATIC_DICTIONARY = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/**
 * Root of every cache holding SOMEBODY ELSE'S view — the manager-side preview
 * of a member's artist surfaces (`?artist=<id>` on the five read-models).
 *
 * It is a root of its own rather than a suffix under `PERSONAL_READMODEL_KEYS`,
 * for two reasons that are both load-bearing. `useUpsertScheduleAttendance`
 * patches optimistically by PREFIX over `["schedule","dashboard"]`, so a preview
 * nested under that prefix would be silently rewritten by the manager's own RSVP
 * made somewhere else entirely — the preview would then show a rehearsal answer
 * that belongs to the wrong person. And a distinct root makes "never persist
 * this" a one-line predicate instead of a per-query audit.
 */
export const PREVIEW_QUERY_ROOT = "preview";

/** Cache key for one preview read. Always rooted, always keyed by the member. */
export const previewQueryKey = (
  ...segments: readonly (string | number)[]
): readonly string[] =>
  [PREVIEW_QUERY_ROOT, ...segments.map(String)] as const;

/**
 * Freshness and retention for a preview read. Spread into every one of them —
 * one constant is the only way this stays true of all five.
 *
 * `persist: false` keeps another person's data out of localStorage: the panel
 * dehydrates its whole cache for 24h of offline paint, and that store lives on
 * the manager's device. `gcTime` is short for the same reason — once the manager
 * leaves the preview there is no case for keeping the member's timeline in
 * memory for the rest of the day. And `retry: false` because every refusal this
 * can meet (403, 404, 409) is final and each attempt writes an audit line.
 */
export const PREVIEW_QUERY_OPTIONS = {
  meta: { persist: false },
  gcTime: 5 * 60 * 1000,
  staleTime: 0,
  retry: false,
  refetchOnMount: "always",
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/**
 * Personal, server-joined read-models that several features write into
 * indirectly. They live in their own feature namespaces (materials / schedule),
 * but project-side mutations (casting, participation, rehearsals) change what
 * they return — so those mutations must be able to invalidate them without an
 * illegal feature↔feature import. This shared registry is the seam: both the
 * owning feature and the writing feature point here.
 *
 * Note: invalidating these only reconciles caches in the *current* session. The
 * common case — a manager casting a chorister who is looking at their own
 * device — is carried across sessions by `RECONCILING_REFETCH` on the dashboards
 * themselves (refetch on the chorister's next mount / focus).
 */
export const PERSONAL_READMODEL_KEYS = {
  materialsDashboard: ["materials", "dashboard"] as const,
  scheduleDashboard: ["schedule", "dashboard"] as const,
};

/**
 * Mark the chorister's personal read-models (their Materials program and their
 * Schedule) stale after a project-side change that alters their membership or
 * casting. A no-op for queries not currently mounted; the dashboards' own
 * `RECONCILING_REFETCH` carries the change to other sessions on next focus.
 */
export const invalidatePersonalReadModels = (
  queryClient: QueryClient,
): void => {
  void queryClient.invalidateQueries({
    queryKey: PERSONAL_READMODEL_KEYS.materialsDashboard,
  });
  void queryClient.invalidateQueries({
    queryKey: PERSONAL_READMODEL_KEYS.scheduleDashboard,
  });
};
